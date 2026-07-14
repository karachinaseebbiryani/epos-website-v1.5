import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";
import SocialLoginButtons from "../components/SocialLoginButtons";

export default function RegisterPage() {
    const { register, verifyEmail, resendOtp } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const redirectTo = params.get("redirect") || "/profile";
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
    const [loading, setLoading] = useState(false);
    // OTP step: set once a new (unverified) account is created.
    const [verifyStep, setVerifyStep] = useState(false);
    const [otp, setOtp] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        const phoneDigits = (form.phone || "").replace(/\D/g, "");
        if (phoneDigits && phoneDigits.length < 11) {
            toast.error("Phone number must contain at least 11 digits"); return;
        }
        setLoading(true);
        try {
            const data = await register({ ...form, phone: phoneDigits });
            if (data && data.email_verified === false) {
                // New account must confirm the emailed code before it can order.
                setVerifyStep(true);
                toast.success("Account created — check your email for a verification code.");
            } else {
                toast.success("Account created!");
                navigate(redirectTo);
            }
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    const submitOtp = async (e) => {
        e.preventDefault();
        if (otp.trim().length < 4) { toast.error("Enter the 6-digit code"); return; }
        setLoading(true);
        try {
            await verifyEmail(otp.trim());
            toast.success("Email verified — you're all set!");
            navigate(redirectTo);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const doResend = async () => {
        try {
            await resendOtp();
            toast.success("A new code has been sent to your email.");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Could not resend");
        }
    };

    if (verifyStep) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4 py-16" data-testid="verify-email-page">
                <div className="w-full max-w-md bg-white border border-neutral-100 rounded-2xl p-8 shadow-sm">
                    <div className="text-center mb-7">
                        <h1 className="font-display font-black text-3xl text-brand-ink">Verify your email</h1>
                        <p className="text-neutral-500 text-sm mt-1">Enter the 6-digit code we sent to {form.email}</p>
                    </div>
                    <form onSubmit={submitOtp} className="space-y-4">
                        <input inputMode="numeric" maxLength={6} value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} data-testid="verify-otp-input"
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-center text-2xl font-black tracking-[0.4em]" />
                        <button type="submit" disabled={loading} data-testid="verify-otp-submit"
                            className="w-full bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3.5 font-bold transition-colors">
                            {loading ? "Verifying..." : "Verify"}
                        </button>
                    </form>
                    <button type="button" onClick={doResend} className="w-full text-brand-red font-semibold text-sm mt-4 hover:underline">Resend code</button>
                    <button type="button" onClick={() => navigate(redirectTo)} className="w-full text-neutral-500 text-sm mt-2 hover:underline">Verify later</button>
                </div>
            </div>
        );
    }

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
                    <Field label="Phone (11+ digits, optional)" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "") })} testid="register-phone" />
                    <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} testid="register-password" required />
                    <button type="submit" disabled={loading} data-testid="register-submit"
                        className="w-full bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3.5 font-bold transition-colors">
                        {loading ? "Creating..." : "Create Account"}
                    </button>
                </form>
                <SocialLoginButtons onSuccess={(to) => navigate(to || redirectTo)} redirectTo={redirectTo} />
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
