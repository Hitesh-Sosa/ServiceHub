import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import api, { getAccessToken, errMsg } from "../api";
import { useAuth } from "../context/AuthContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function Chat() {
  const params = useParams();

  // THE FIX: the route is defined as "/bookings/:id/chat" in App.jsx, so the
  // param is `id`. Some versions/routes may use `:bookingId`. Accept BOTH -
  // this mismatch (bookingId === undefined) was sending requests to
  // /api/chat/undefined, which the backend rejected with "Invalid ID format".
  const bookingId = params.bookingId || params.id;

  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [conn, setConn] = useState("connecting"); // connecting | live | offline
  const [ready, setReady] = useState(!!getAccessToken());
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  // --- Guard: wait until the access token is restored after a page reload --
  useEffect(() => {
    if (ready) return;
    const t = setInterval(() => {
      if (getAccessToken()) { clearInterval(t); setReady(true); }
    }, 100);
    const timeout = setTimeout(() => {
      if (!getAccessToken()) {
        clearInterval(t);
        setErr("Session expired. Please log in again.");
      }
    }, 8000);
    return () => { clearInterval(t); clearTimeout(timeout); };
  }, [ready]);

  // merge without duplicates, always chronological - used by BOTH the
  // history load and the live socket events, so they can never
  // duplicate or overwrite each other
  function mergeMessages(list) {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m._id));
      const add = (list || []).filter((m) => m && m._id && !seen.has(m._id));
      if (!add.length) return prev;
      return [...prev, ...add].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    });
  }

  // --- Load history + connect socket (only once token + bookingId exist) ---
  useEffect(() => {
    if (!ready) return;

    // hard guard: never fire requests with an undefined id
    if (!bookingId) {
      setErr("Missing booking id in the URL. Go back to bookings and open the chat again.");
      return;
    }

    api.get(`/chat/${bookingId}`)
      .then(({ data }) => mergeMessages(Array.isArray(data) ? data : []))
      .catch((e) => setErr(errMsg(e)));

    const socket = io(SOCKET_URL, { auth: { token: getAccessToken() } });
    socketRef.current = socket;

    socket.on("connect", () => {
      // server.js may ack (new version) or not (old version) - handle both
      let acked = false;
      socket.emit("joinBooking", bookingId, (res) => {
        acked = true;
        if (res?.ok) {
          setConn("live");
        } else {
          setConn("offline");
          setErr(`Chat room unavailable: ${res?.reason || "rejected"}. You can still send messages.`);
        }
      });
      setTimeout(() => { if (!acked) setConn("live"); }, 1500);
    });

    socket.on("disconnect", () => setConn("offline"));
    socket.on("connect_error", () => setConn("offline"));

    socket.on("newMessage", (m) => mergeMessages([m]));

    return () => socket.disconnect();
  }, [ready, bookingId]);

  // --- Auto-scroll to newest message --------------------------------------
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !bookingId) return;
    try {
      const { data } = await api.post(`/chat/${bookingId}`, { content });
      setText("");
      // If our own socket is down, the broadcast never reaches us - append
      // the REST response directly (dedupe prevents doubles).
      if (!socketRef.current?.connected && data?.data) {
        mergeMessages([data.data]);
      }
    } catch (e2) { setErr(errMsg(e2)); }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link to="/my-bookings">← Back to bookings</Link>
        <span className={`chip ${conn === "live" ? "Confirmed" : "Pending"}`}>
          {conn === "live" ? "● Live" : conn === "connecting" ? "Connecting..." : "○ Offline"}
        </span>
      </div>

      <div className="card" style={{ height: 420, overflowY: "auto" }}>
        {messages.map((m) => {
          const mine = String(m.sender?._id) === String(user?.id);
          return (
            <p key={m._id} style={{ textAlign: mine ? "right" : "left", margin: "6px 0" }}>
              <span style={{
                display: "inline-block", maxWidth: "80%", padding: "6px 10px",
                borderRadius: 10, background: mine ? "#dbeafe" : "#f1f5f9",
              }}>
                {!mine && <b>{m.sender?.name || "User"}: </b>}
                {m.content}
              </span>
            </p>
          );
        })}
        {!messages.length && !err && <p className="muted">No messages yet. Say hello!</p>}
        <div ref={bottomRef} />
      </div>

      {err && <p className="error">{err}</p>}
      <form onSubmit={send} className="row">
        <input className="input" style={{ flex: 1, margin: 0 }} value={text}
               onChange={(e) => setText(e.target.value)}
               placeholder={conn === "live" ? "Type a message..." : "Type a message (offline mode)..."} />
        <button className="btn">Send</button>
      </form>
    </div>
  );
}