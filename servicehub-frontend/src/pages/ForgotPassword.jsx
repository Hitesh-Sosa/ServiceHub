import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errMsg } from "../api";

export default function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  async function requestOtp(e) {
    e.preventDefault();
    setMsg("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setUserId(data.userId || "");
      setStep(2);
      setMsg(data.userId
        ? "Reset OTP sent — in dev mode check the backend terminal."
        : data.message);
    } catch (e2) { setMsg(errMsg(e2)); }
  }

  async function reset(e) {
    e.preventDefault();
    setMsg("");
    try {
      const { data } = await api.post("/auth/reset-password", { userId, otp, newPassword });
      setDone(true);
      setMsg(data.message);
      setTimeout(() => nav("/login"), 1500);
    } catch (e2) { setMsg(errMsg(e2)); }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Reset password</h2>
        {step === 1 ? (
          <form onSubmit={requestOtp}>
            <label>Account email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {msg && <p className="muted">{msg}</p>}
            <button className="btn">Send reset OTP</button>
          </form>
        ) : (
          <form onSubmit={reset}>
            <label>OTP</label>
            <input className="input" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} required />
            <label>New password (min 8 chars)</label>
            <input className="input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            {msg && <p className={done ? "muted" : "error"}>{msg}</p>}
            <button className="btn" disabled={done}>Update password</button>
          </form>
        )}
        <p className="muted"><Link to="/login">Back to login</Link></p>
      </div>
    </div>
  );
}