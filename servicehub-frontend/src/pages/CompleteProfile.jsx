import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { errMsg } from "../api";
import { useAuth } from "../context/AuthContext";

export default function CompleteProfile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState("Customer");
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post("/auth/complete-profile", { mobile, role });
      nav("/verify-otp", { state: { userId: user.id, channel: "mobile" } });
    } catch (e2) { setMsg(errMsg(e2)); }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Complete your profile</h2>
        <p className="muted">Add your mobile number to finish signing up with Google.</p>
        <form onSubmit={submit}>
          <label>Mobile (with country code)</label>
          <input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} required />
          <label>I am a</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Customer">Customer</option>
            <option value="Provider">Provider</option>
          </select>
          {msg && <p className="error">{msg}</p>}
          <button className="btn">Continue</button>
        </form>
      </div>
    </div>
  );
}