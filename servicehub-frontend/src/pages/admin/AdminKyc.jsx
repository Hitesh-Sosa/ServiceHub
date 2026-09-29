import { useEffect, useState } from "react";
// import api, { errMsg } from "../api";
import api, { errMsg } from "../../api";

const SERVER = new URL(import.meta.env.VITE_API_URL || "http://localhost:5000/api").origin;

export default function AdminKyc() {
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");

  async function load() {
    try { const { data } = await api.get("/admin/kyc?status=Pending"); setList(data); }
    catch (e) { setMsg(errMsg(e)); }
  }
  useEffect(() => { load(); }, []);

  async function review(id, action) {
    const reason = action === "reject" ? window.prompt("Rejection reason:") : undefined;
    if (action === "reject" && !reason) return;
    try { await api.put(`/admin/kyc/${id}/review`, { action, reason }); load(); }
    catch (e) { alert(errMsg(e)); }
  }

  return (
    <div>
      <h2>KYC review</h2>
      {msg && <p className="error">{msg}</p>}
      {!list.length && <p className="muted">Nothing pending. 🎉</p>}
      {list.map((k) => (
        <div key={k._id} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <b>{k.provider?.name}</b> <span className="muted">({k.provider?.email})</span>
              <p style={{ margin: "4px 0" }}>{k.idType} — {k.idNumber} · {k.fullName}</p>
              <a href={`${SERVER}${k.documentUrl}`} target="_blank" rel="noreferrer">View document</a>
            </div>
            <div>
              <button className="btn small" onClick={() => review(k._id, "approve")}>Approve</button>
              <button className="btn small danger" onClick={() => review(k._id, "reject")}>Reject</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}