import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Access token lives in memory only (matches your backend design). The
// refreshToken lives in localStorage and is used to silently renew it.
let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;

export const errMsg = (e) =>
  e?.response?.data?.message || e?.message || "Something went wrong";

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// On 401: refresh once, retry the original request. If refresh fails,
// session is dead -> clear storage and go to login.
let refreshPromise = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const refreshToken = localStorage.getItem("refreshToken");

    if (
      error.response?.status === 401 &&
      refreshToken &&
      !original._retry &&
      !original.url.includes("/auth/refresh-token") &&
      !original.url.includes("/auth/login")
    ) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ||
          axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
        const { data } = await refreshPromise;
        refreshPromise = null;
        setAccessToken(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        refreshPromise = null;
        setAccessToken(null);
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;