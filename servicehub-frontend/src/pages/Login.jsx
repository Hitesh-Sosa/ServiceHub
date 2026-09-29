import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import api, { errMsg } from "../api";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, googleLogin } = useAuth();
  const nav = useNavigate();

  function landing(role) {
    return role === "Admin" ? "/admin" : role === "Provider" ? "/provider/services" : "/";
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const u = await login(email, password);
      nav(landing(u.role));
    } catch (e2) {
      const data = e2.response?.data;
      if (data?.requiresVerification) {
        nav("/verify-otp", { state: { userId: data.userId, channel: "email" } });
      } else setMsg(errMsg(e2));
    } finally { setBusy(false); }
  }

  async function onGoogleSuccess(credentialResponse) {
    try {
      const data = await googleLogin(credentialResponse.credential);
      if (data.profileIncomplete) nav("/complete-profile");
      else nav(landing(data.user.role));
    } catch (e2) { setMsg(errMsg(e2)); }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Login</h2>
        <form onSubmit={submit}>
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {msg && <p className="error">{msg}</p>}
          <button className="btn" disabled={busy}>{busy ? "Logging in..." : "Login"}</button>
        </form>
        <p className="muted"><Link to="/forgot-password">Forgot password?</Link></p>
        {GOOGLE_CLIENT_ID?.startsWith && GOOGLE_CLIENT_ID.includes(".apps.googleusercontent.com") && (
          <>
            <div className="row" style={{ margin: "10px 0" }}><span className="muted">— or —</span></div>
            <GoogleLogin onSuccess={onGoogleSuccess} onError={() => setMsg("Google sign-in failed")} />
          </>
        )}
        <p className="muted">No account? <Link to="/register">Register</Link></p>
      </div>
    </div>
  );
}