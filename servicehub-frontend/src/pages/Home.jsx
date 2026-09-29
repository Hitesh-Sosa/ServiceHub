import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../api";

export default function Home() {
  const [services, setServices] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [geo, setGeo] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (sortBy) params.sortBy = sortBy;
    if (geo) { params.lat = geo.lat; params.lng = geo.lng; }

    const t = setTimeout(() => {
      api.get("/services", { params })
        .then(({ data }) => { setServices(data); setMsg(""); })
        .catch((e) => setMsg(errMsg(e)));
    }, 350);
    return () => clearTimeout(t);
  }, [q, category, sortBy, geo]);

  function nearMe() {
    if (!navigator.geolocation) return setMsg("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMsg("Could not get your location")
    );
  }

  return (
    <div>
      <h2>Find a service</h2>
      <div className="card row">
        <input className="input" style={{ flex: 2, margin: 0 }} placeholder="Search..."
               value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input" style={{ flex: 1, margin: 0 }} placeholder="Category e.g. Plumbing"
               value={category} onChange={(e) => setCategory(e.target.value)} />
        <select style={{ width: 160, margin: 0 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="">Sort</option>
          <option value="rating">Top rated</option>
          <option value="distance">Nearest</option>
        </select>
        <button className="btn ghost" onClick={nearMe}>Near me</button>
      </div>
      {msg && <p className="error">{msg}</p>}
      {geo && <p className="muted">Showing results nearest to you.</p>}

      <div className="grid">
        {services.map((s) => (
          <Link key={s._id} to={`/services/${s._id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ height: "100%" }}>
              <h3 style={{ marginTop: 0 }}>{s.category}</h3>
              <p className="muted">{s.description?.slice(0, 80)}...</p>
              <p><b>₹{s.price}</b> · {s.location?.area ? `${s.location.area}, ` : ""}{s.location?.city}</p>
              <p className="muted">
                by {s.provider?.name}
                {s.provider?.isProviderVerified ? " ✅" : ""}
              </p>
              {/* FIX: show THIS service's own rating - not the provider's overall.
                  Each service is rated independently; unrated services show "New". */}
              <p>
                ⭐ <b>{s.averageRating > 0 ? `${s.averageRating}/10` : "New"}</b>{" "}
                <span className="muted">(this service)</span>
                {s.distanceKm != null ? ` · ${s.distanceKm} km away` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
      {!services.length && !msg && <p className="muted">No services found.</p>}
    </div>
  );
}