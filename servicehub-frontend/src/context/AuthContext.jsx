import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import api, { setAccessToken, API_URL } from "../api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));

  function saveSession(data) {
    // data = { user, accessToken, refreshToken } (same shape from login & verify-otp)
    setAccessToken(data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }

  // Restore the session after a page reload: exchange refreshToken for a new
  // accessToken. (Refresh endpoint does not rotate tokens, so this is safe.)
  useEffect(() => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return;
    axios.post(`${API_URL}/auth/refresh-token`, { refreshToken })
      .then(({ data }) => setAccessToken(data.accessToken))
      .catch(() => {
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        setUser(null);
      });
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    saveSession(data);
    return data.user;
  }

  async function googleLogin(idToken) {
    const { data } = await api.post("/auth/google", { idToken });
    saveSession(data); // works for both branches (both return user + tokens)
    return data;
  }

  async function logout() {
    try {
      await api.post("/auth/logout", { refreshToken: localStorage.getItem("refreshToken") });
    } catch { /* ignore - clearing locally regardless */ }
    setAccessToken(null);
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, saveSession, login, googleLogin, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);