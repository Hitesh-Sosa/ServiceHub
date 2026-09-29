import { useEffect, useState } from "react";
// import api, { errMsg } from "../api";
import api, { errMsg } from "../../api";

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [msg, setMsg] = useState("");

  async function load() {
    try { const { data } = await api.get("/admin/reports"); setReports(data); }
    catch (e) { setMsg(errMsg(e)); }
  }
  useEffect(() => { load(); }, []);

  async function setStatus(r, status) {
    try { await api.put(`/admin/reports/${r._id}`, { status }); load(); }
    catch (e) { alert(errMsg(e)); }
  }
  async function suspend(providerId) {
    const reason = window.prompt("Suspension reason:");
    if (!reason) return;
    try { await api.put(`/admin/providers/${providerId}/suspend`, { reason }); load(); }
    catch (e) { alert(errMsg(e)); }
  }
  async function unsuspend(providerId) {
    try { await api.put(`/admin/providers/${providerId}/unsuspend`); load(); }
    catch (e) { alert(errMsg(e)); }
  }

  return (
    <div>
      <h2>Reports</h2>
      {msg && <p className="error">{msg}</p>}
      {!reports.length && <p className="muted">No reports.</p>}
      {reports.map((r) => (
        <div key={r._id} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <b>{r.reportedProvider?.name}</b>{" "}
              <span className={`chip ${r.reportedProvider?.accountStatus}`}>
                {r.reportedProvider?.accountStatus}
              </span>
              <p style={{ margin: "6px 0" }}><b>{r.reason}</b> — {r.details || "no details"}</p>
              <p className="muted">
                Reported by {r.reportedBy?.email} · {new Date(r.createdAt).toLocaleString()}
                {r.reportedProvider?.suspensionReason ? ` · ${r.reportedProvider.suspensionReason}` : ""}
              </p>
            </div>
            <div>
              {r.reportedProvider?.accountStatus === "Active"
                ? <button className="btn small danger" onClick={() => suspend(r.reportedProvider._id)}>Suspend</button>
                : <button className="btn small" onClick={() => unsuspend(r.reportedProvider._id)}>Unsuspend</button>}
              <button className="btn small ghost" onClick={() => setStatus(r, "Reviewed")}>Mark reviewed</button>
              <button className="btn small ghost" onClick={() => setStatus(r, "Dismissed")}>Dismiss</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}