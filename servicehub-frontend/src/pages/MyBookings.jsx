import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import api, { getAccessToken, errMsg } from "../api";
import { useAuth } from "../context/AuthContext";
import { payForBooking } from "../utils/pay";
import ReportModal from "../components/ReportModal";
import ReviewModal from "../components/ReviewModal";
import CashPaymentModal from "../components/CashPaymentModal";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
const SERVER = new URL(import.meta.env.VITE_API_URL || "http://localhost:5000/api").origin;

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [receipts, setReceipts] = useState({});
  const [msg, setMsg] = useState("");
  const [reporting, setReporting] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [cashClaiming, setCashClaiming] = useState(null); // booking object
  const [reviewedIds, setReviewedIds] = useState([]);
  const [payingId, setPayingId] = useState(null);
  const [ready, setReady] = useState(!!getAccessToken());
  const socketRef = useRef(null);

  const isCustomer = user.role === "Customer";
  const isProvider = user.role === "Provider";

  async function fetchReceipt(bookingId) {
    try {
      const { data: p } = await api.get(`/payments/booking/${bookingId}`);
      if (p) setReceipts((r) => ({ ...r, [bookingId]: p }));
    } catch { /* ignore */ }
  }

  async function load() {
    try {
      const { data } = await api.get("/bookings");
      setBookings(data);
      // fetch payment state for ALL completed bookings (Paid AND cash-pending)
      data.filter((b) => b.status === "Completed").forEach((b) => fetchReceipt(b._id));
    } catch (e) { setMsg(errMsg(e)); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (ready) return;
    const t = setInterval(() => {
      if (getAccessToken()) { clearInterval(t); setReady(true); }
    }, 100);
    return () => clearInterval(t);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const socket = io(SOCKET_URL, { auth: { token: getAccessToken() } });
    socketRef.current = socket;

    socket.on("bookingStatus", (u) => {
      const { bookingId, ...fields } = u;
      setBookings((prev) =>
        prev.map((b) => (b._id === bookingId ? { ...b, ...fields } : b))
      );
      if (fields.paymentStatus === "Paid") fetchReceipt(bookingId);
    });

    return () => socket.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!socketRef.current) return;
    bookings.forEach((b) => socketRef.current.emit("joinBooking", b._id));
  }, [bookings]);

  async function confirmCompletion(b) {
    try {
      const { data } = await api.put(`/bookings/${b._id}/confirm-completion`);
      alert(data.message);
      load();
    } catch (e) { alert(errMsg(e)); }
  }

  async function payOnline(b) {
    setPayingId(b._id);
    try {
      await payForBooking(b._id, user);
      alert("Payment successful. Thank you!");
      load();
    } catch (e) {
      alert(e.message);
    } finally { setPayingId(null); }
  }

  // STEP 2 of cash proof - PROVIDER only, after the customer claimed with photo
  async function confirmCash(b) {
    try {
      const { data } = await api.put(`/payments/cash/${b._id}/confirm`);
      alert(data.message);
      load();
    } catch (e) { alert(errMsg(e)); }
  }

  async function setStatus(b, status) {
    try { await api.put(`/bookings/${b._id}`, { status }); load(); }
    catch (e) { alert(errMsg(e)); }
  }

  async function cancel(b) {
    if (!window.confirm("Cancel this booking?")) return;
    try { await api.delete(`/bookings/${b._id}`); load(); }
    catch (e) { alert(errMsg(e)); }
  }

  return (
    <div>
      <h2>{isProvider ? "Incoming bookings" : "My bookings"}</h2>
      {msg && <p className="error">{msg}</p>}
      {!bookings.length && <p className="muted">No bookings yet.</p>}

      {bookings.map((b) => {
        const paid = b.paymentStatus === "Paid";
        const workDone = b.status === "Completed";
        const receipt = receipts[b._id];
        const customerConfirmed = b.customerPaymentConfirmed;
        const providerConfirmed = b.providerPaymentConfirmed;
        const cashPending = workDone && !paid && customerConfirmed && !providerConfirmed;
        const canPay = workDone && !paid && !customerConfirmed;

        return (
          <div key={b._id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>{b.service?.category}</h3>
              <span>
                <span className={`chip ${b.status}`}>{b.status}</span>{" "}
                {workDone && (
                  <span className={`chip ${paid ? "Approved" : "Pending"}`}>
                    {paid ? "Paid" : customerConfirmed ? "Payment 1/2 confirmed" : "Payment pending"}
                  </span>
                )}
              </span>
            </div>
            <p>
              ₹{b.service?.price} ·{" "}
              {isProvider ? `Customer: ${b.customer?.name}` : `Provider: ${b.provider?.name}`}
            </p>
            <p className="muted">
              {new Date(b.dateTime).toLocaleString()} · {b.address}
            </p>

            <div className="row">
              <Link className="btn small ghost" to={`/bookings/${b._id}/chat`}>Chat</Link>

              {/* ---------- PROVIDER ---------- */}
              {isProvider && b.status === "Pending" && (
                <>
                  <button className="btn small" onClick={() => setStatus(b, "Confirmed")}>Accept</button>
                  <button className="btn small danger" onClick={() => setStatus(b, "Rejected")}>Reject</button>
                </>
              )}
              {isProvider && b.status === "Confirmed" && !b.customerConfirmedCompletion && (
                <span className="muted">⏳ The CUSTOMER must verify and confirm the work first.</span>
              )}
              {isProvider && b.status === "Confirmed" && b.customerConfirmedCompletion && !b.providerConfirmedCompletion && (
                <>
                  <span className="muted">✅ Customer confirmed the work is done.</span>
                  <button className="btn small" onClick={() => confirmCompletion(b)}>Mark work completed</button>
                </>
              )}

              {/* PROVIDER: cash step 2 - only after customer claimed with photo */}
              {isProvider && cashPending && (
                <>
                  <span className="muted">Customer marked cash payment completed with photo proof:</span>
                  {receipt?.cashProofPhotoUrl && (
                    <a href={`${SERVER}${receipt.cashProofPhotoUrl}`} target="_blank" rel="noreferrer">
                      📷 View handover photo
                    </a>
                  )}
                  <button className="btn small" onClick={() => confirmCash(b)}>Payment completed ✓</button>
                </>
              )}
              {isProvider && workDone && !paid && !customerConfirmed && b.customerConfirmedCompletion && (
                <span className="muted">⏳ Waiting for the CUSTOMER to pay (online or cash with photo).</span>
              )}

              {/* ---------- CUSTOMER ---------- */}
              {isCustomer && b.status === "Pending" && (
                <>
                  <span className="muted">Waiting for the provider to accept — you pay only after the work is done and confirmed by both.</span>
                  <button className="btn small ghost" onClick={() => cancel(b)}>Cancel</button>
                </>
              )}
              {isCustomer && b.status === "Confirmed" && !b.customerConfirmedCompletion && (
                <>
                  <span className="muted">
                    After the work is done, verify it and confirm FIRST — the provider can only mark completion after you.
                  </span>
                  <button className="btn small" onClick={() => confirmCompletion(b)}>Work is completed — confirm</button>
                  <button className="btn small danger"
                          onClick={() => setReporting({ providerId: b.provider?._id, bookingId: b._id })}>
                    Work not done properly? Report
                  </button>
                </>
              )}
              {isCustomer && b.status === "Confirmed" && b.customerConfirmedCompletion && !b.providerConfirmedCompletion && (
                <span className="muted">⏳ Your confirmation recorded. Waiting for the PROVIDER to mark completion…</span>
              )}

              {/* CUSTOMER: pay step - online, or cash with photo (step 1) */}
              {isCustomer && canPay && (
                <>
                  <span className="muted">Both sides confirmed the work. Pay the locked price of ₹{b.service?.price}:</span>
                  <button className="btn small" disabled={payingId === b._id} onClick={() => payOnline(b)}>
                    {payingId === b._id ? "Opening checkout..." : "Pay online"}
                  </button>
                  <button className="btn small ghost" onClick={() => setCashClaiming(b)}>Paid by cash</button>
                </>
              )}
              {isCustomer && cashPending && (
                <span className="muted">
                  ⏳ Your "Payment completed" + photo recorded. Waiting for the PROVIDER to press "Payment completed"…
                </span>
              )}

              {/* SHARED PROOF - both sides, after Paid */}
              {paid && receipt && (
                <span className="muted">
                  🧾 Receipt: <b>{receipt.method === "cash" ? "Cash" : "Online"}</b> ·
                  txn <b>{receipt.txnId}</b> · ₹{receipt.amount} ·
                  {b.paidAt ? new Date(b.paidAt).toLocaleString() : new Date(receipt.createdAt).toLocaleString()}
                  {receipt.method === "cash" && receipt.cashProofPhotoUrl && (
                    <> · <a href={`${SERVER}${receipt.cashProofPhotoUrl}`} target="_blank" rel="noreferrer">📷 photo</a></>
                  )}
                </span>
              )}
              {paid && !receipt && <span className="muted">🧾 Loading receipt...</span>}

              {isCustomer && !workDone && (
                <button className="btn small danger"
                        onClick={() => setReporting({ providerId: b.provider?._id, bookingId: b._id })}>
                  Report provider
                </button>
              )}

              {isCustomer && paid && !reviewedIds.includes(b._id) && (
                <button className="btn small" onClick={() => setReviewing(b)}>Leave a review ⭐</button>
              )}
            </div>
          </div>
        );
      })}

      {reporting && (
        <ReportModal providerId={reporting.providerId} bookingId={reporting.bookingId}
                     onClose={() => { setReporting(null); load(); }} />
      )}

      {reviewing && (
        <ReviewModal booking={reviewing}
                     onClose={() => setReviewing(null)}
                     onDone={() => {
                       setReviewedIds((prev) => [...prev, reviewing._id]);
                       setReviewing(null);
                     }} />
      )}

      {cashClaiming && (
        <CashPaymentModal booking={cashClaiming}
                          onClose={() => setCashClaiming(null)}
                          onDone={() => { setCashClaiming(null); load(); }} />
      )}
    </div>
  );
}