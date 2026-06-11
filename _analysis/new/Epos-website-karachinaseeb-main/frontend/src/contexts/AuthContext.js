import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined); // undefined = checking, null = no user
    const [token, setToken] = useState(localStorage.getItem("knb_token"));

    useEffect(() => {
        if (!token) { setUser(null); return; }
        api.get("/customer/me")
            .then((r) => setUser(r.data))
            .catch(() => { localStorage.removeItem("knb_token"); setToken(null); setUser(null); });
    }, [token]);

    const login = async (email, password) => {
        const { data } = await api.post("/customer/login", { email, password });
        localStorage.setItem("knb_token", data.token);
        setToken(data.token);
        setUser(data);
        return data;
    };

    const register = async (payload) => {
        const { data } = await api.post("/customer/register", payload);
        localStorage.setItem("knb_token", data.token);
        setToken(data.token);
        setUser(data);
        return data;
    };

    const logout = () => {
        localStorage.removeItem("knb_token");
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
