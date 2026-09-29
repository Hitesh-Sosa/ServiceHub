import { useState } from "react";
import api, { errMsg } from "../api";

// Rating options in 0.5 steps: 10, 9.5, 9 ... 0.5
const RATING_OPTIONS = Array.from({ length: 20 }, (_, i) => 10 - i * 0.5);

// Matches reviewController: POST /api/reviews { bookingId, rating (0.5 steps), comment }
// Only allowed when the booking is Completed AND Paid; one review per booking.
export default function ReviewModal({ booking, onClose, onDone }) {
  const [rating, setRating] = useState(10);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const { data } = await api.post("/reviews", {
        bookingId: booking._id,
        rating: Number(rating),
        comment,
      });
      alert(data.message || "Review submitted");
      onDone();
    } catch (e2) {
      setMsg(errMsg(e2)); // e.g. "A review already exists for this booking"
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Review {booking.provider?.name}</h3>
        <p className="muted">{booking.service?.category} · {new Date(booking.dateTime).toLocaleDateString()}</p>

        <label>Rating out of 10 (steps of 0.5)</label>
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          {RATING_OPTIONS.map((v) => (
            <option key={v} value={v}>{v} / 10</option>
          ))}
        </select>

        <label>Comment (optional)</label>
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="How was the service?" />

        {msg && <p className="error">{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? "Submitting..." : "Submit review"}</button>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}