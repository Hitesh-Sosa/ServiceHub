import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../api";

export default function Kyc() {
  const [kyc, setKyc] = useState(null);
  const [form, setForm] = useState({ fullName: "", idType: "Aadhaar", idNumber: "" });
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const { data } = await api.get("/kyc/me"); setKyc(data); }
    catch (e) { setMsg(errMsg(e)); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!file) return setMsg("Please choose an ID document (JPG/PNG/PDF, max 5 MB).");
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("document", file);
      fd.append("fullName", form.fullName);
      fd.append("idType", form.idType);
      fd.append("idNumber", form.idNumber);
      await api.post("/kyc", fd); // axios sets multipart headers automatically
      alert("KYC submitted for review.");
      load();
    } catch (e2) { setMsg(errMsg(e2)); }
    finally { setBusy(false); }
  }

  const canSubmit = !kyc || kyc.status === "NotSubmitted" || kyc.status === "Rejected";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h2>KYC verification</h2>

      {kyc && kyc.status !== "NotSubmitted" && (
        <div className="card">
          <p>Status: <span className={`chip ${kyc.status}`}>{kyc.status}</span></p>
          {kyc.status === "Rejected" && <p className="error">Reason: {kyc.rejectionReason}</p>}
          {kyc.status === "Pending" && <p className="muted">An admin will review your document shortly.</p>}
          {kyc.status === "Approved" && <p className="muted">✅ You are verified — your services are visible to customers.</p>}
        </div>
      )}

      {canSubmit ? (
        <div className="card">
          <h3>Submit KYC document</h3>
          <form onSubmit={submit}>
            <label>Full name (as on ID)</label>
            <input className="input" value={form.fullName}
                   onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            <label>ID type</label>
            <select value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
              <option>Aadhaar</option><option>PAN</option>
              <option>Passport</option><option>DrivingLicense</option>
            </select>
            <label>ID number</label>
            <input className="input" value={form.idNumber}
                   onChange={(e) => setForm({ ...form, idNumber: e.target.value })} required />
            <label>Document (JPG/PNG/PDF, max 5 MB)</label>
            <input className="input" type="file" accept="image/jpeg,image/png,application/pdf"
                   onChange={(e) => setFile(e.target.files[0])} />
            {msg && <p className="error">{msg}</p>}
            <button className="btn" disabled={busy}>{busy ? "Uploading..." : "Submit KYC"}</button>
          </form>
        </div>
      ) : (
        <p className="muted"><Link to="/provider/services">← Back to my services</Link></p>
      )}
    </div>
  );
}