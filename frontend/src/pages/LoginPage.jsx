import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";
import SocialLoginButtons from "../components/SocialLoginButtons";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const redirectTo = params.get("redirect") || "/profile";
    const [form, setForm] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    // Forgot-password flow: null = hidden, "email" = ask email, "reset" = code+new password.
    const [forgotStep, setForgotStep] = useState(null);
    const [reset, setReset] = useState({ otp: "", password: "" });

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(form.email, form.password);
            toast.success("Welcome back!");
            navigate(redirectTo);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const sendResetCode = async (e) => {
        e.preventDefault();
        if (!form.email.includes("@")) { toast.error("Enter your account email first"); return; }
        setLoading(true);
        try {
            await api.post("/customer/forgot-password", { email: form.email });
            setForgotStep("reset");
            toast.success("If an account exists for that email, a code has been sent.");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Could not send the code");
        } finally {
            setLoading(false);
        }
    };

    const doReset = async (e) => {
        e.preventDefault();
        if (reset.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        setLoading(true);
        try {
            await api.post("/customer/reset-password", { email: form.email, otp: reset.otp, new_password: reset.password });
            toast.success("Password updated — sign in with your new password.");
            setForgotStep(null);
            setReset({ otp: "", password: "" });
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Reset failed");
        } finally {
            setLoading(false);
        }
    };

    if (forgotStep) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4 py-16" data-testid="forgot-password-page">
                <div className="w-full max-w-md bg-white border border-neutral-100 rounded-2xl p-8 shadow-sm">
                    <div className="text-center mb-7">
                        <h1 className="font-display font-black text-3xl text-brand-ink">Reset Password</h1>
                        <p className="text-neutral-500 text-sm mt-1">
                            {forgotStep === "email" ? "We'll email you a 6-digit code" : `Enter the code sent to ${form.email}`}
                        </p>
                    </div>
                    <form onSubmit={forgotStep === "email" ? sendResetCode : doReset} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-brand-ink mb-2">Email</label>
                            <input type="email" required maxLength={100} value={form.email} disabled={forgotStep === "reset"}
                                onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="forgot-email"
                                className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm disabled:opacity-60" />
                        </div>
                        {forgotStep === "reset" && (
                            <>
                                <input inputMode="numeric" maxLength={6} placeholder="6-digit code" value={reset.otp}
                                    onChange={(e) => setReset({ ...reset, otp: e.target.value.replace(/\D/g, "") })} data-testid="forgot-otp"
                                    className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-center text-xl font-black tracking-[0.35em]" />
                                <input type="password" maxLength={72} placeholder="New password" value={reset.password}
                                    onChange={(e) => setReset({ ...reset, password: e.target.value })} data-testid="forgot-new-password"
                                    className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                            </>
                        )}
                        <button type="submit" disabled={loading} data-testid="forgot-submit"
                            className="w-full bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3.5 font-bold transition-colors">
                            {loading ? "Please wait..." : forgotStep === "email" ? "Send Code" : "Set New Password"}
                        </button>
                    </form>
                    {forgotStep === "reset" && (
                        <button type="button" onClick={sendResetCode} className="w-full text-brand-red font-semibold text-sm mt-4 hover:underline">Resend code</button>
                    )}
                    <button type="button" onClick={() => setForgotStep(null)} className="w-full text-neutral-500 text-sm mt-2 hover:underline">Back to sign in</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4 py-16" data-testid="login-page">
            <div className="w-full max-w-md bg-white border border-neutral-100 rounded-2xl p-8 shadow-sm">
                <div className="text-center mb-7">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-brand-red text-white flex items-center justify-center font-display font-black text-2xl">K</div>
                    <h1 className="font-display font-black text-3xl text-brand-ink">Welcome Back</h1>
                    <p className="text-neutral-500 text-sm mt-1">Sign in to continue ordering</p>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Email</label>
                        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="login-email"
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Password</label>
                        <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="login-password"
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                        <button type="button" onClick={() => setForgotStep("email")} data-testid="forgot-password-link"
                            className="block ml-auto mt-1.5 text-xs text-brand-red font-semibold hover:underline">Forgot password?</button>
                    </div>
                    <button type="submit" disabled={loading} data-testid="login-submit"
                        className="w-full bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3.5 font-bold transition-colors">
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
                <SocialLoginButtons onSuccess={(to) => navigate(to || redirectTo)} redirectTo={redirectTo} />
                <p className="text-center text-sm text-neutral-500 mt-6">
                    Don&apos;t have an account?{" "}
                    <Link to="/register" data-testid="register-link" className="text-brand-red font-semibold hover:underline">Create one</Link>
                </p>
            </div>
        </div>
    );
}
