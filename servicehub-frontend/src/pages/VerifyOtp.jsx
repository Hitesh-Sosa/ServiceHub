import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api, { errMsg } from "../api";
import { useAuth } from "../context/AuthContext";

export default function VerifyOtp() {
  const { state } = useLocation();
  const nav = useNavigate();
  const { saveSession } = useAuth();
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const userId = state?.userId;

  if (!userId) {
    return <p>Missing verification context. <Link to="/register">Register again</Link></p>;
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const { data } = await api.post("/auth/verify-otp", { userId, otp });
      saveSession(data);
      nav(data.user.role === "Provider" ? "/provider/services" : "/");
    } catch (e2) { setMsg(errMsg(e2)); }
    finally { setBusy(false); }
  }

  async function resend() {
    setMsg("");
    try {
      await api.post("/auth/resend-otp", { userId, channel: state?.channel || "email" });
      setMsg("A new OTP has been sent.");
    } catch (e2) { setMsg(errMsg(e2)); }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Verify OTP</h2>
        <p className="muted">
          Enter the 6-digit code. In dev mode it appears in the <b>backend terminal</b>.
          It expires in 1 minute.
        </p>
        <form onSubmit={submit}>
          <input className="input" inputMode="numeric" maxLength={6} placeholder="6-digit OTP"
                 value={otp} onChange={(e) => setOtp(e.target.value)} required />
          {msg && <p className={msg.includes("sent") ? "muted" : "error"}>{msg}</p>}
          <button className="btn" disabled={busy}>{busy ? "Verifying..." : "Verify"}</button>
          <button type="button" className="btn ghost" onClick={resend}>Resend OTP</button>
        </form>
      </div>
    </div>
  );
}