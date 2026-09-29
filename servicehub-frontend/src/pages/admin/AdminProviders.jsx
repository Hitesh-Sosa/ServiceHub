import { useEffect, useState } from "react";
// import api, { errMsg } from "../api";
import api, { errMsg } from "../../api";

export default function AdminProviders() {
  const [providers, setProviders] = useState([]);
  const [msg, setMsg] = useState("");

  async function load() {
    try { const { data } = await api.get("/admin/providers"); setProviders(data); }
    catch (e) { setMsg(errMsg(e)); }
  }
  useEffect(() => { load(); }, []);

  async function toggleVerify(p) {
    try { await api.put(`/admin/providers/${p._id}/verify`, { isVerified: !p.isProviderVerified }); load(); }
    catch (e) { alert(errMsg(e)); }
  }
  async function suspend(p) {
    const reason = window.prompt("Suspension reason:");
    if (!reason) return;
    try { await api.put(`/admin/providers/${p._id}/suspend`, { reason }); load(); }
    catch (e) { alert(errMsg(e)); }
  }
  async function unsuspend(p) {
    try { await api.put(`/admin/providers/${p._id}/unsuspend`); load(); }
    catch (e) { alert(errMsg(e)); }
  }

  return (
    <div>
      <h2>Providers</h2>
      {msg && <p className="error">{msg}</p>}
      {providers.map((p) => (
        <div key={p._id} className="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <b>{p.name}</b> <span className="muted">({p.email})</span>{" "}
            <span className={`chip ${p.isProviderVerified ? "Approved" : "Pending"}`}>
              {p.isProviderVerified ? "Verified" : "Unverified"}
            </span>{" "}
            <span className={`chip ${p.accountStatus}`}>{p.accountStatus}</span>
          </div>
          <div>
            <button className="btn small ghost" onClick={() => toggleVerify(p)}>
              {p.isProviderVerified ? "Un-verify" : "Verify"}
            </button>
            {p.accountStatus === "Active"
              ? <button className="btn small danger" onClick={() => suspend(p)}>Suspend</button>
              : <button className="btn small" onClick={() => unsuspend(p)}>Unsuspend</button>}
          </div>
        </div>
      ))}
    </div>
  );
}