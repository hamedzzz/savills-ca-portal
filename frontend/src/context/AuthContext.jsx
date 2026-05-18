import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);
const API = import.meta.env.VITE_API_URL || "http://localhost:8001";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const apiFetch = async (path, opts = {}) => {
    const token = localStorage.getItem("ca_token");
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers }
    });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Error"); }
    return res.json();
  };

  useEffect(() => {
    const token = localStorage.getItem("ca_token");
    if (token) apiFetch("/auth/me").then(u => { if (u) setUser(u); }).finally(() => setLoading(false));
    else setLoading(false);
  }, []);

  const login = async (username, password) => {
    const d = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    localStorage.setItem("ca_token", d.token);
    setUser(d.user);
  };

  const logout = () => { localStorage.removeItem("ca_token"); setUser(null); };
  const isAdmin = user?.role === "admin";

  return <AuthContext.Provider value={{ user, loading, login, logout, apiFetch, isAdmin, API }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
