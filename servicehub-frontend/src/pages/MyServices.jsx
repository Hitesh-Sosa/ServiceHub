import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../api";
import { useAuth } from "../context/AuthContext";

export default function MyServices() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: "", description: "", price: "", city: "", area: "", availability: true,
  });

  async function load() {
    try { const { data } = await api.get("/services/mine"); setServices(data); }
    catch (e) { setMsg(errMsg(e)); }
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) =>
    setForm({ ...form, [k]: k === "availability" ? e.target.checked : e.target.value });

  async function addService(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await api.post("/services", {
        category: form.category,
        description: form.description,
        price: Number(form.price),
        availability: form.availability,
        location: { city: form.city, area: form.area },
      });
      setForm({ category: "", description: "", price: "", city: "", area: "", availability: true });
      load();
    } catch (e2) { setMsg(errMsg(e2)); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    if (!window.confirm("Delete this service listing?")) return;
    try { await api.delete(`/services/${id}`); load(); }
    catch (e) { alert(errMsg(e)); }
  }

  return (
    <div>
      <h2>My services</h2>
      {!user.isProviderVerified && (
        <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
          ⚠️ Your account is <b>not verified yet</b>. Your services stay hidden from customers
          until an admin approves your <Link to="/provider/kyc">KYC</Link>.
        </div>
      )}

      {services.map((s) => (
        <div key={s._id} className="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <b>{s.category}</b> — ₹{s.price}{" "}
            <span className={`chip ${s.availability ? "Confirmed" : "Rejected"}`}>
              {s.availability ? "Available" : "Unavailable"}
            </span>
            <p className="muted" style={{ margin: "4px 0 0" }}>{s.description}</p>
          </div>
          <button className="btn small danger" onClick={() => remove(s._id)}>Delete</button>
        </div>
      ))}
      {!services.length && !msg && <p className="muted">No services yet — add your first one below.</p>}

      <div className="card">
        <h3>Add a service</h3>
        <form onSubmit={addService}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Category</label>
              <input className="input" value={form.category} onChange={set("category")} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Price (₹)</label>
              <input className="input" type="number" min="1" value={form.price} onChange={set("price")} required />
            </div>
          </div>
          <label>Description</label>
          <textarea rows={2} value={form.description} onChange={set("description")} required />
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>City</label>
              <input className="input" value={form.city} onChange={set("city")} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Area</label>
              <input className="input" value={form.area} onChange={set("area")} />
            </div>
          </div>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={form.availability} onChange={set("availability")} />
            Available for booking
          </label>
          {msg && <p className="error">{msg}</p>}
          <button className="btn" disabled={busy}>{busy ? "Adding..." : "Add service"}</button>
        </form>
      </div>
    </div>
  );
}