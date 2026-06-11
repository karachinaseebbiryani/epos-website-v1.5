import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";
import SocialLoginButtons from "../components/SocialLoginButtons";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const redirectTo = params.get("redirect") || "/profile";
    const [form, setForm] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);

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
