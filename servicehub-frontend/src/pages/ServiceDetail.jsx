import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { errMsg } from "../api";
import { useAuth } from "../context/AuthContext";

export default function ServiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [service, setService] = useState(null);
  const [allProviderReviews, setAllProviderReviews] = useState([]);
  const [when, setWhen] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/services/${id}`)
      .then(({ data }) => {
        setService(data);
        if (data?.provider?._id) {
          api.get(`/reviews/${data.provider._id}`)
            .then(({ data: rev }) => setAllProviderReviews(Array.isArray(rev) ? rev : []))
            .catch(() => {});
        }
      })
      .catch((e) => setMsg(errMsg(e)));
  }, [id]);

  // FIX: show only reviews given to THIS specific service.
  // The provider may have many services - each service shows only its own
  // reviews. (r.service._id is always included by Mongoose populate.)
  const serviceReviews = allProviderReviews.filter(
    (r) => String(r.service?._id) === String(id)
  );

  async function book(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await api.post("/bookings", {
        serviceId: id,
        dateTime: new Date(when).toISOString(),
        address,
      });
      alert("Booking created! The provider will accept it. You pay only after the work is completed.");
      nav("/my-bookings");
    } catch (e2) { setMsg(errMsg(e2)); }
    finally { setBusy(false); }
  }

  if (!service) return <p className="muted">{msg || "Loading..."}</p>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link to="/">← Back to services</Link>

      <div className="card">
        <h2>{service.category}</h2>
        <p>{service.description}</p>
        <p><b>₹{service.price}</b></p>

        {/* FIX: main rating = THIS service's own average (out of 10) */}
        <p>
          ⭐ <b>{service.averageRating > 0 ? `${service.averageRating}/10` : "New — no ratings yet"}</b>{" "}
          <span className="muted">for this service</span>
        </p>

        <p className="muted">
          Provider: <b>{service.provider?.name}</b>
          {service.provider?.isProviderVerified ? " ✅ verified" : ""}
          {" · overall across ALL their services: "}
          {service.provider?.averageRating ?? 0}/10
        </p>
      </div>

      <div className="card">
        <h3>Reviews for this service ({serviceReviews.length})</h3>
        {serviceReviews.map((r) => (
          <div key={r._id} style={{ borderTop: "1px solid #e2e8f0", padding: "8px 0" }}>
            <b>{r.customer?.name || "Customer"}</b> — <b>{r.rating}/10</b>{" "}
            <span className="muted">{new Date(r.createdAt).toLocaleDateString()}</span>
            {r.comment && <p style={{ margin: "4px 0 0" }}>{r.comment}</p>}
          </div>
        ))}
        {!serviceReviews.length && (
          <p className="muted">No reviews for this specific service yet.</p>
        )}
        {allProviderReviews.length > serviceReviews.length && (
          <p className="muted" style={{ marginTop: 8 }}>
            The provider has {allProviderReviews.length} review(s) in total across all their services.
          </p>
        )}
      </div>

      {user?.role === "Customer" && (
        <div className="card">
          <h3>Book this service</h3>
          <p className="muted">
            Agreed price: <b>₹{service.price}</b> — locked at booking time and cannot be changed.
            You pay <b>only after the work is completed</b>, online (Razorpay) or by cash —
            and paying confirms the work was done properly.
          </p>
          <form onSubmit={book}>
            <label>Date &amp; time</label>
            <input className="input" type="datetime-local" required
                   min={new Date().toISOString().slice(0, 16)}
                   value={when} onChange={(e) => setWhen(e.target.value)} />
            <label>Your address</label>
            <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} required />
            {msg && <p className="error">{msg}</p>}
            <button className="btn" disabled={busy}>{busy ? "Booking..." : "Create booking"}</button>
          </form>
        </div>
      )}
      {!user && <p className="muted"><Link to="/login">Login</Link> as a customer to book this service.</p>}
      {user?.role === "Provider" && (
        <p className="muted">You are logged in as a Provider — only Customers can book services.</p>
      )}
    </div>
  );
}