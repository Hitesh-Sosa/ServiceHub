import { useState } from "react";
import api, { errMsg } from "../api";

const REASONS = ["FakeProfile", "NoShow", "FraudPayment", "Misbehavior", "Other"];

export default function ReportModal({ providerId, bookingId, onClose }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/reports", { providerId, bookingId, reason, details });
      alert(data.autoSuspended
        ? "Report submitted. This provider has been suspended pending review."
        : "Report submitted. Our team will review it.");
      onClose();
    } catch (e2) {
      setMsg(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Report provider</h3>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => <option key={r} value={r}>{r.replace(/([A-Z])/g, " $1").trim()}</option>)}
        </select>
        <textarea rows={4} placeholder="What happened?" value={details}
                  onChange={(e) => setDetails(e.target.value)} />
        {msg && <p className="error">{msg}</p>}
        <button className="btn danger" disabled={busy}>{busy ? "Sending..." : "Submit report"}</button>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}