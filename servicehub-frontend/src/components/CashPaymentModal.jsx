import { useRef, useState } from "react";
import api, { errMsg } from "../api";

// STEP 1 of cash proof: customer uploads the handover photo and presses
// "Payment completed". The provider then confirms (strict order).
export default function CashPaymentModal({ booking, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  function pick(e) {
    const f = e.target.files[0];
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e) {
    e.preventDefault();
    if (!file) return setMsg("Please take/choose the photo of the cash handover.");
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("bookingId", booking._id);
      const { data } = await api.post("/payments/cash", fd);
      alert(data.message);
      onDone();
    } catch (e2) {
      setMsg(errMsg(e2));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Cash payment — proof</h3>
        <p className="muted">
          Upload a photo of the cash handover (both of you with the money), then press
          "Payment completed". The provider confirms after you — only then the payment
          is marked <b>Paid</b> and you can rate the work.
        </p>
        <label>Handover photo (JPG/PNG, max 5 MB)</label>
        <input ref={fileRef} className="input" type="file" accept="image/jpeg,image/png"
               onChange={pick} />
        {preview && (
          <img src={preview} alt="preview" style={{ maxWidth: "100%", borderRadius: 8, margin: "8px 0" }} />
        )}
        {msg && <p className="error">{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? "Uploading..." : "Payment completed ✓"}</button>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}