import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOtp from "./pages/VerifyOtp";
import CompleteProfile from "./pages/CompleteProfile";
import ForgotPassword from "./pages/ForgotPassword";
import ServiceDetail from "./pages/ServiceDetail";
import MyBookings from "./pages/MyBookings";
import Chat from "./pages/Chat";
import MyServices from "./pages/MyServices";
import Kyc from "./pages/Kyc";
import AdminKyc from "./pages/admin/AdminKyc";
import AdminReports from "./pages/admin/AdminReports";
import AdminProviders from "./pages/admin/AdminProviders";

export default function App() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/services/:id" element={<ServiceDetail />} />

          <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="/bookings/:id/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

          <Route path="/provider/services" element={<ProtectedRoute roles={["Provider"]}><MyServices /></ProtectedRoute>} />
          <Route path="/provider/kyc" element={<ProtectedRoute roles={["Provider"]}><Kyc /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute roles={["Admin"]}><AdminKyc /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={["Admin"]}><AdminReports /></ProtectedRoute>} />
          <Route path="/admin/providers" element={<ProtectedRoute roles={["Admin"]}><AdminProviders /></ProtectedRoute>} />

          <Route path="*" element={<p>Page not found</p>} />
        </Routes>
      </div>
    </>
  );
}