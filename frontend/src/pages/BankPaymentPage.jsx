import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api, { formatApiError, API } from "../lib/api";
import axios from "axios";
import { toast } from "sonner";
import { Building2, Smartphone, Copy, Upload, FileImage, X, ArrowRight } from "lucide-react";

export default function BankPaymentPage() {
    const { state } = useLocation();
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(state?.order || null);
    const [settings, setSettings] = useState(state?.settings || null);
    const [via, setVia] = useState("bank");
    const [form, setForm] = useState({ transaction_id: "", payer_name: "" });
    const [file, setFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!order) api.get(`/online-orders/${id}`).then((r) => setOrder(r.data)).catch(() => navigate("/"));
        if (!settings) api.get("/public/settings").then((r) => setSettings(r.data)).catch(() => { });
    }, [id, order, settings, navigate]);

    const copy = (text) => { navigator.clipboard.writeText(text); toast.success("Copied"); };

    const onFileChange = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB)"); return; }
        const okTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!okTypes.includes(f.type)) { toast.error("Use JPG, PNG, WebP or PDF"); return; }
        setFile(f);
        if (f.type.startsWith("image/")) {
            const r = new FileReader();
            r.onload = () => setFilePreview(r.result);
            r.readAsDataURL(f);
        } else {
            setFilePreview(null);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Submit reference
            await api.post(`/online-orders/${id}/bank-payment`, { ...form, payment_via: via });
            // Optionally upload screenshot
            if (file) {
                const fd = new FormData();
                fd.append("file", file);
                await axios.post(`${API}/online-orders/${id}/payment-screenshot`, fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
            }
            toast.success("Payment details submitted! We'll verify shortly.");
            // Forward the per-order share token so the tracking page works even if the
            // customer signs out / shares the link.
            const tokenParam = order?.track_token ? `?t=${encodeURIComponent(order.track_token)}` : "";
            navigate(`/track/${id}${tokenParam}`, { state: { order: { ...order, payment_status: "pending_verification", payment_method: via } } });
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        } finally { setSubmitting(false); }
    };

    if (!order || !settings) return <div className="p-12 text-center text-neutral-400">Loading...</div>;
    const total = order.total_price?.toFixed(0);

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16" data-testid="bank-payment-page">
            <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mb-2">Complete Your Payment</h1>
            <p className="text-neutral-500 mb-1">Order <span className="font-mono font-semibold">#{order.receipt_no}</span> · Total <span className="font-bold text-brand-red">Rs. {total}</span></p>
            <p className="text-sm text-neutral-400 mb-8">Choose a method, transfer the amount, then submit your transaction reference and (optional) screenshot.</p>

            <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
                {[
                    { k: "bank", l: "Bank Transfer", I: Building2 },
                    { k: "easypaisa", l: "EasyPaisa", I: Smartphone },
                    { k: "jazzcash", l: "JazzCash", I: Smartphone },
                ].map(({ k, l, I }) => (
                    <button key={k} onClick={() => setVia(k)} data-testid={`bank-tab-${k}`}
                        className={`whitespace-nowrap inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${via === k ? "bg-brand-red text-white" : "bg-neutral-100 text-brand-ink hover:bg-neutral-200"}`}>
                        <I className="w-4 h-4" /> {l}
                    </button>
                ))}
            </div>

            <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm mb-6">
                {via === "bank" && (
                    <div className="space-y-3">
                        <Row label="Account Title" value={settings.bank_account_title} onCopy={copy} />
                        <Row label="Bank Name" value={settings.bank_name} onCopy={copy} />
                        <Row label="Account Number" value={settings.bank_account_number} onCopy={copy} />
                        {settings.iban && <Row label="IBAN" value={settings.iban} onCopy={copy} />}
                    </div>
                )}
                {via === "easypaisa" && (
                    <div className="space-y-3">
                        <Row label="EasyPaisa Number" value={settings.easypaisa_number} onCopy={copy} />
                        {settings.easypaisa_account_title && <Row label="Account Title" value={settings.easypaisa_account_title} onCopy={copy} />}
                    </div>
                )}
                {via === "jazzcash" && (
                    <div className="space-y-3">
                        <Row label="JazzCash Number" value={settings.jazzcash_number} onCopy={copy} />
                        {settings.jazzcash_account_title && <Row label="Account Title" value={settings.jazzcash_account_title} onCopy={copy} />}
                    </div>
                )}
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                    <strong>Amount to transfer: Rs. {total}</strong>. After transferring, paste the transaction ID below.
                </div>
            </div>

            <form onSubmit={submit} className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
                <h3 className="font-display font-bold text-lg mb-4">Submit Reference</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Transaction ID / Reference *</label>
                        <input required value={form.transaction_id} onChange={(e) => setForm({ ...form, transaction_id: e.target.value })} data-testid="bank-txn-id"
                            placeholder="TX-12345"
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Sender Name (optional)</label>
                        <input value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} data-testid="bank-payer-name"
                            placeholder="Name on the transferring account"
                            className="w-full px-4 py-3 bg-neutral-50 border border-transparent focus:border-brand-red focus:bg-white rounded-xl outline-none text-sm" />
                    </div>

                    {/* File upload */}
                    <div>
                        <label className="block text-sm font-semibold text-brand-ink mb-2">Payment Screenshot (optional)</label>
                        <div className="text-xs text-neutral-500 mb-2">Upload a screenshot of your transaction receipt. JPG, PNG, WebP or PDF, max 5MB.</div>
                        {!file ? (
                            <label data-testid="bank-file-label"
                                className="flex flex-col items-center justify-center gap-2 p-8 bg-neutral-50 border-2 border-dashed border-neutral-300 hover:border-brand-red rounded-xl cursor-pointer transition-colors">
                                <Upload className="w-7 h-7 text-neutral-400" />
                                <span className="text-sm font-semibold text-brand-ink">Click to upload</span>
                                <span className="text-xs text-neutral-500">or drag here</span>
                                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onFileChange} data-testid="bank-file-input" className="hidden" />
                            </label>
                        ) : (
                            <div className="relative bg-neutral-50 rounded-xl p-4 flex items-center gap-3">
                                {filePreview ? (
                                    <img src={filePreview} alt="Preview" className="w-20 h-20 rounded-lg object-cover" />
                                ) : (
                                    <FileImage className="w-12 h-12 text-brand-red" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm text-brand-ink truncate" data-testid="bank-file-name">{file.name}</div>
                                    <div className="text-xs text-neutral-500">{(file.size / 1024).toFixed(1)} KB</div>
                                </div>
                                <button type="button" onClick={() => { setFile(null); setFilePreview(null); }} data-testid="bank-file-remove"
                                    className="w-8 h-8 rounded-full hover:bg-red-50 text-red-500 flex items-center justify-center"><X className="w-4 h-4" /></button>
                            </div>
                        )}
                    </div>
                </div>
                <button type="submit" disabled={submitting} data-testid="bank-submit"
                    className="w-full mt-6 bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 transition-colors">
                    {submitting ? "Submitting..." : "Submit & Track Order"} <ArrowRight className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}

function Row({ label, value, onCopy }) {
    return (
        <div className="flex items-center justify-between gap-3 py-2 border-b border-neutral-100 last:border-0">
            <div className="min-w-0">
                <div className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">{label}</div>
                <div className="font-mono text-sm font-bold text-brand-ink truncate">{value}</div>
            </div>
            <button type="button" onClick={() => onCopy(value)} className="px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-brand-red hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors">
                <Copy className="w-3 h-3" /> Copy
            </button>
        </div>
    );
}
