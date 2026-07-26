import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "../../lib/api";
import { toast } from "sonner";

export default function AdminLoginPage() {
    // Start blank so the page never advertises credentials; the browser's own
    // saved-password autofill still pre-fills them for a returning user.
    const [form, setForm] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await api.post("/auth/login", form);
            if (data.role !== "admin") {
                toast.error("Admin access only");
                setLoading(false);
                return;
            }
            localStorage.setItem("knb_admin_token", data.token);
            toast.success("Welcome, Admin!");
            navigate("/admin");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-ink flex items-center justify-center p-4" data-testid="admin-login-page">
            <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-7">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-brand-red text-white flex items-center justify-center font-display font-black text-2xl">K</div>
                    <h1 className="font-display font-black text-3xl text-brand-ink">Admin Sign In</h1>
                    <p className="text-neutral-500 text-sm mt-1">Manage Karachi Naseeb operations</p>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Email</label>
                        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="admin-login-email"
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Password</label>
                        <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="admin-login-password"
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                    </div>
                    <button type="submit" disabled={loading} data-testid="admin-login-submit"
                        className="w-full bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3.5 font-bold transition-colors">
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}
