import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/")) {
      localStorage.removeItem("auth_token");
      delete axios.defaults.headers.common["Authorization"];
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const savedToken = localStorage.getItem("auth_token");
    if (savedToken) axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
    try {
      const { data } = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(data);
    } catch {
      localStorage.removeItem("auth_token");
      delete axios.defaults.headers.common["Authorization"];
      setUser(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    if (data.token) { localStorage.setItem("auth_token", data.token); axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`; }
    setUser(data);
    return data;
  };

  const register = async (email, password, name, role = "cashier") => {
    const { data } = await axios.post(`${API}/auth/register`, { email, password, name, role }, { withCredentials: true });
    if (data.token) { localStorage.setItem("auth_token", data.token); axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`; }
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await axios.post(`${API}/auth/logout`, {}, { withCredentials: true }); } catch {}
    localStorage.removeItem("auth_token");
    delete axios.defaults.headers.common["Authorization"];
    setUser(false);
  };

  return (<AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
