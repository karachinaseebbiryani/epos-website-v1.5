// Staff JWT auth — talks to /api/auth/* (admin/cashier users from OLD POS system).
// Keeps its own localStorage key ("staff_auth_token") so it does NOT collide with
// the customer AuthContext (which uses "knb_token") or the admin online panel
// (which uses "knb_admin_token").
//
// Usage: wrap legacy operational pages in <StaffAuthProvider> and use useStaffAuth().
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const StaffAuthContext = createContext(null);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "staff_auth_token";

// Build a dedicated axios instance so we don't pollute the global axios defaults
// (the customer AuthContext + lib/api.js use their own headers).
export const staffAxios = axios.create({ baseURL: API, withCredentials: true });

staffAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

staffAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = "/admin/sign-in";
    }
    return Promise.reject(error);
  }
);

export function StaffAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const savedToken = localStorage.getItem(STORAGE_KEY);
    if (!savedToken) {
      setUser(false);
      setLoading(false);
      return;
    }
    try {
      const { data } = await staffAxios.get(`/auth/me`);
      setUser(data);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await staffAxios.post(`/auth/login`, { email, password });
    if (data.token) {
      localStorage.setItem(STORAGE_KEY, data.token);
    }
    setUser(data);
    return data;
  };

  const register = async (email, password, name, role = "cashier") => {
    const { data } = await staffAxios.post(`/auth/register`, { email, password, name, role });
    if (data.token) {
      localStorage.setItem(STORAGE_KEY, data.token);
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await staffAxios.post(`/auth/logout`, {}); } catch { /* ignore */ }
    localStorage.removeItem(STORAGE_KEY);
    setUser(false);
  };

  return (
    <StaffAuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error("useStaffAuth must be inside StaffAuthProvider");
  return ctx;
}

// Back-compat: legacy pages import `useAuth` from "../contexts/AuthContext".
// The shim file at frontend/src/contexts/AuthContextLegacyShim.js re-exports
// useStaffAuth as useAuth, but legacy pages import from a relative path.
// Easiest path: keep their imports unchanged but route them to this provider via
// a thin shim file (`contexts/AuthContext.legacy.js`) — see App.js wiring.
