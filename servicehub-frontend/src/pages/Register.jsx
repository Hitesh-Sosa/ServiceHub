import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errMsg } from "../api";

export default function Register() {
  const [form, setForm] = useState({
    name: "", email: "", password: "", mobile: "", role: "Customer", verifyVia: "email",
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const { data } = await api.post("/auth/register", form);
      nav("/verify-otp", { state: { userId: data.userId, channel: data.otpChannel } });
    } catch (e2) { setMsg(errMsg(e2)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Register</h2>
        <form onSubmit={submit}>
          <label>Full name</label>
          <input className="input" value={form.name} onChange={set("name")} required />
          <label>Email</label>
          <input className="input" type="email" value={form.email} onChange={set("email")} required />
          <label>Password (min 8 chars)</label>
          <input className="input" type="password" minLength={8} value={form.password} onChange={set("password")} required />
          <label>Mobile (with country code, e.g. +9198...)</label>
          <input className="input" value={form.mobile} onChange={set("mobile")} required />
          <label>I am a</label>
          <select value={form.role} onChange={set("role")}>
            <option value="Customer">Customer</option>
            <option value="Provider">Provider</option>
          </select>
          <label>Verify via</label>
          <select value={form.verifyVia} onChange={set("verifyVia")}>
            <option value="email">Email OTP</option>
            <option value="mobile">SMS OTP</option>
          </select>
          {msg && <p className="error">{msg}</p>}
          <button className="btn" disabled={busy}>{busy ? "Sending OTP..." : "Register"}</button>
        </form>
        <p className="muted">Already registered? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}