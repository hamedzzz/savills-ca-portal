import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);
const API = import.meta.env.VITE_API_URL || "http://localhost:8001";

// Default theme (fallback if settings not loaded yet)
const DEFAULT_SETTINGS = {
  app_name: "Savills Egypt CA",
  logo_url: "https://savills-ca-portal.vercel.app/savills-logo.svg",
  primary_color: "#0077C5",
  accent_color: "#FEDE07",
  font_family: "Inter",
  email_sender_name: "Savills Egypt — Client Accounting",
  email_sender_email: "ahmed.hamed@savills.me",
  portal_tagline: "Client Accounting · Property Management",
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const apiFetch = async (path, opts = {}) => {
    const token = localStorage.getItem("ca_token");
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
    });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || "Error");
    }
    return res.json();
  };

  const loadSettings = async () => {
    try {
      const s = await apiFetch("/settings");
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
    } catch (e) {
      console.warn("Could not load app settings:", e);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("ca_token");
    if (token) {
      Promise.all([
        apiFetch("/auth/me").then(u => { if (u) setUser(u); }),
        loadSettings(),
      ]).finally(() => setLoading(false));
    } else {
      loadSettings(); // load settings even for login page
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const d = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem("ca_token", d.token);
    setUser(d.user);
    await loadSettings();
  };

  const logout = () => {
    localStorage.removeItem("ca_token");
    setUser(null);
  };

  const updateSettings = async (newSettings) => {
    await apiFetch("/settings", {
      method: "PATCH",
      body: JSON.stringify(newSettings),
    });
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const isAdmin  = user?.role === "admin";
  const isEditor = user?.role === "admin" || user?.role === "editor";

  // Apply font from settings to document
  useEffect(() => {
    if (settings.font_family) {
      document.documentElement.style.setProperty("--app-font", settings.font_family);
    }
  }, [settings.font_family]);

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout,
      apiFetch, isAdmin, isEditor, API,
      settings, updateSettings, loadSettings,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
