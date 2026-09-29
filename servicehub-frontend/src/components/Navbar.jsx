import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  async function handleLogout() {
    await logout();
    nav("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/"><b>ServiceHub</b></Link>
      {user?.role === "Provider" && (
        <>
          <NavLink to="/provider/services">My Services</NavLink>
          <NavLink to="/provider/kyc">KYC</NavLink>
          <NavLink to="/my-bookings">Bookings</NavLink>
        </>
      )}
      {user?.role === "Customer" && <NavLink to="/my-bookings">My Bookings</NavLink>}
      {user?.role === "Admin" && (
        <>
          <NavLink to="/admin" end>KYC Review</NavLink>
          <NavLink to="/admin/reports">Reports</NavLink>
          <NavLink to="/admin/providers">Providers</NavLink>
        </>
      )}
      <span className="spacer" />
      {user ? (
        <>
          <span className="muted">{user.name} ({user.role})</span>
          <button className="btn small ghost" onClick={handleLogout}>Logout</button>
        </>
      ) : (
        <>
          <NavLink to="/login">Login</NavLink>
          <NavLink to="/register">Register</NavLink>
        </>
      )}
    </nav>
  );
}