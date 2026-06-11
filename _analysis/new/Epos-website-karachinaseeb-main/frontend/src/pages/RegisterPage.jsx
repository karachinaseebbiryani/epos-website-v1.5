import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const redirectTo = params.get("redirect") || "/profile";
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        setLoading(true);
        try {
            await register(form);
            toast.success("Account created!");
            navigate(redirectTo);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4 py-16" data-testid="register-page">
            <div className="w-full max-w-md bg-white border border-neutral-100 rounded-2xl p-8 shadow-sm">
                <div className="text-center mb-7">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-brand-red text-white flex items-center justify-center font-display font-black text-2xl">K</div>
                    <h1 className="font-display font-black text-3xl text-brand-ink">Create Account</h1>
                    <p className="text-neutral-500 text-sm mt-1">Order your favorites in seconds</p>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    <Field label="Full Name" type="text" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="register-name" required />
                    <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="register-email" required />
                    <Field label="Phone (optional)" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="register-phone" />
                    <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} testid="register-password" required />
                    <button type="submit" disabled={loading} data-testid="register-submit"
                        className="w-full bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3.5 font-bold transition-colors">
                        {loading ? "Creating..." : "Create Account"}
                    </button>
                </form>
                <p className="text-center text-sm text-neutral-500 mt-6">
                    Already a member?{" "}
                    <Link to="/login" data-testid="login-link" className="text-brand-red font-semibold hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
}

function Field({ label, type, value, onChange, testid, required }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">{label}</label>
            <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid}
                className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
        </div>
    );
}
