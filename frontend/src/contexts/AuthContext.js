import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined); // undefined = checking, null = no user
    const [token, setToken] = useState(localStorage.getItem("knb_token"));

    const refreshUser = async () => {
        const currentToken = localStorage.getItem("knb_token");
        if (!currentToken) {
            setUser(null);
            return null;
        }

        try {
            const { data } = await api.get("/customer/me");
            setUser(data);
            return data;
        } catch {
            localStorage.removeItem("knb_token");
            setToken(null);
            setUser(null);
            return null;
        }
    };

    useEffect(() => {
        if (!token) { setUser(null); return; }
        refreshUser();
    }, [token]);

    const login = async (email, password) => {
        const { data } = await api.post("/customer/login", { email, password });
        localStorage.setItem("knb_token", data.token);
        setToken(data.token);
        const fullProfile = await refreshUser();
        setUser(fullProfile || data);
        try { window.dispatchEvent(new Event("diamondsUpdated")); } catch { /* */ }
        return data;
    };

    const register = async (payload) => {
        const { data } = await api.post("/customer/register", payload);
        localStorage.setItem("knb_token", data.token);
        setToken(data.token);
        const fullProfile = await refreshUser();
        setUser(fullProfile || data);
        try { window.dispatchEvent(new Event("diamondsUpdated")); } catch { /* */ }
        return data;
    };

    /**
     * Social login (Google/Facebook). The backend verifies the upstream token, find-or-creates
     * the customer by email, and returns the same shape as /customer/login so the rest of the
     * app keeps working unchanged.
     * @param {'google'|'facebook'} provider
     * @param {object} payload - { credential } for Google, { access_token, user_id } for Facebook
     */
    const socialLogin = async (provider, payload) => {
        const endpoint = provider === "facebook" ? "/customer/facebook" : "/customer/google";
        const { data } = await api.post(endpoint, payload);
        localStorage.setItem("knb_token", data.token);
        setToken(data.token);
        const fullProfile = await refreshUser();
        setUser(fullProfile || data);
        try { window.dispatchEvent(new Event("diamondsUpdated")); } catch { /* */ }
        return data;
    };

    // Email OTP verification (email/password signups). Social logins are already verified.
    const verifyEmail = async (otp) => {
        const { data } = await api.post("/customer/verify-email", { otp });
        setUser((u) => (u ? { ...u, email_verified: true } : u));
        return data;
    };

    const resendOtp = async () => {
        const { data } = await api.post("/customer/resend-otp");
        return data;
    };

    const logout = () => {
        localStorage.removeItem("knb_token");
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout, socialLogin, verifyEmail, resendOtp, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
