import { useEffect, useState, useCallback } from "react";
import api, { formatApiError, resolveImageUrl, API } from "../../lib/api";
import { Plus, Trash2, Pencil, X, Share2, Copy, ExternalLink, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const SITE = window.location.origin; // https://www.karachinaseebbiryani.com

const EMPTY = {
    title: "", description: "",
    discount_percent: 0, discount_amount: 0,
    coupon_code: "", image_url: "",
    active: true,
    min_order_amount: 0,
    valid_until: "",
    // New fields
    distribution: ["website", "app"],
    usage_limit: "",
    assigned_customer_id: "",
};

const isoToLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};
const localInputToIso = (local) => {
    if (!local) return null;
    const d = new Date(local);
    return isNaN(d.getTime()) ? null : d.toISOString();
};

function statusBadge(o) {
    const s = o.computed_status || (o.active ? "ACTIVE" : "INACTIVE");
    const map = {
        ACTIVE:        { cls: "text-green-700 bg-green-50",   label: "Active",         Icon: CheckCircle2 },
        INACTIVE:      { cls: "text-neutral-500 bg-neutral-100", label: "Inactive",    Icon: XCircle },
        EXPIRED:       { cls: "text-red-700 bg-red-50",       label: "Expired",         Icon: Clock },
        FULLY_REDEEMED:{ cls: "text-purple-700 bg-purple-50", label: "Fully Redeemed",  Icon: AlertCircle },
    };
    const { cls, label, Icon } = map[s] || map.INACTIVE;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded ${cls}`}>
            <Icon className="w-3 h-3" /> {label}
        </span>
    );
}

function distLabel(dist) {
    if (!dist || !dist.length) return "Website + App";
    if (dist.includes("voucher_code_only") && !dist.includes("website") && !dist.includes("app"))
        return "Voucher Code Only 🔒";
    const parts = [];
    if (dist.includes("website")) parts.push("Website");
    if (dist.includes("app")) parts.push("App");
    return parts.join(" + ") || "None";
}

export default function AdminOffers() {
    const [offers, setOffers] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [shareFor, setShareFor] = useState(null); // offer object for share modal
    const [customerSearch, setCustomerSearch] = useState("");
    const [customerResults, setCustomerResults] = useState([]);

    const load = useCallback(async () => {
        // Admin list — includes private 'voucher_code_only' vouchers that the
        // public /offers endpoint hides. Without this, private vouchers vanish
        // from this page (no card, no share button) right after creation.
        const { data } = await api.get("/admin/offers", { params: { active_only: false } });
        setOffers(data);
    }, []);
    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditing("new");
        setForm({ ...EMPTY });
        setCustomerSearch(""); setCustomerResults([]);
    };
    const openEdit = (o) => {
        setEditing(o.id);
        setForm({
            title: o.title, description: o.description,
            discount_percent: o.discount_percent, discount_amount: o.discount_amount,
            coupon_code: o.coupon_code, image_url: o.image_url,
            active: o.active,
            min_order_amount: Number(o.min_order_amount || 0),
            valid_until: isoToLocalInput(o.valid_until),
            distribution: o.distribution || ["website", "app"],
            usage_limit: o.usage_limit != null ? String(o.usage_limit) : "",
            assigned_customer_id: o.assigned_customer_id || "",
        });
        setCustomerSearch(""); setCustomerResults([]);
    };

    const toggleDist = (key) => {
        setForm((f) => {
            const d = f.distribution || [];
            if (key === "voucher_code_only") {
                return { ...f, distribution: d.includes(key) ? d.filter(k => k !== key) : [...d.filter(k => k !== "website" && k !== "app"), key] };
            }
            const next = d.includes(key) ? d.filter(k => k !== key) : [...d.filter(k => k !== "voucher_code_only"), key];
            return { ...f, distribution: next };
        });
    };

    const searchCustomers = async (q) => {
        setCustomerSearch(q);
        if (!q || q.length < 2) { setCustomerResults([]); return; }
        try {
            const { data } = await api.get("/admin/customers", { params: { search: q, limit: 8 } });
            setCustomerResults(data?.customers || data || []);
        } catch { setCustomerResults([]); }
    };

    const generateCode = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        setForm((f) => ({ ...f, coupon_code: code }));
    };

    const save = async (e) => {
        e.preventDefault();
        try {
            const validUntilIso = localInputToIso(form.valid_until);
            if (validUntilIso && new Date(validUntilIso).getTime() <= Date.now()) {
                if (!window.confirm("The 'valid until' time is already in the past, so this offer cannot be redeemed. Save anyway?")) return;
            }
            const payload = {
                ...form,
                valid_until: validUntilIso,
                usage_limit: form.usage_limit !== "" ? Number(form.usage_limit) : null,
                assigned_customer_id: form.assigned_customer_id || null,
            };
            if (editing === "new") {
                await api.post("/offers", payload);
                toast.success("Offer created");
            } else {
                await api.put(`/offers/${editing}`, payload);
                toast.success("Offer updated");
            }
            setEditing(null);
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        }
    };

    const remove = async (id) => {
        if (!window.confirm("Delete this offer? This cannot be undone.")) return;
        await api.delete(`/offers/${id}`);
        toast.success("Deleted");
        load();
    };

    const voucherUrl = (o) => o.share_token ? `${SITE}/v/${o.share_token}` : null;

    const copyLink = (o) => {
        const url = voucherUrl(o);
        if (!url) { toast.error("No share link — save the offer first"); return; }
        navigator.clipboard.writeText(url);
        toast.success("Link copied");
    };

    const whatsappShare = (o) => {
        const url = voucherUrl(o);
        if (!url) return;
        const disc = o.discount_amount ? `Rs. ${o.discount_amount} OFF` : o.discount_percent ? `${o.discount_percent}% OFF` : "special discount";
        const validLine = o.valid_until ? `\nValid until: ${new Date(o.valid_until).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}.` : "";
        const msg = `🎁 You have received a special voucher from Karachi Naseeb Biryani!\n\nGet ${disc} on your order.\nVoucher Code: ${o.coupon_code}${validLine}\n\nRedeem here:\n${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    };

    return (
        <div data-testid="admin-offers-page">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
                <div>
                    <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink">Offers & Vouchers</h1>
                    <p className="text-neutral-500 mt-1">{offers.length} total · {offers.filter((o) => o.computed_status === "ACTIVE").length} active</p>
                </div>
                <button onClick={openCreate} data-testid="offers-add-button"
                    className="inline-flex items-center gap-2 bg-brand-red text-white rounded-full px-5 py-2.5 font-semibold text-sm hover:bg-brand-red-dark transition-colors">
                    <Plus className="w-4 h-4" /> New Offer / Voucher
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {offers.map((o) => (
                    <div key={o.id} data-testid={`admin-offer-${o.id}`} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden flex flex-col">
                        {o.image_url && o.image_url.trim() && (
                            <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                                <img src={resolveImageUrl(o.image_url)} alt={o.title} className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className="p-4 flex flex-col flex-1">
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="font-display font-bold text-brand-ink leading-tight">{o.title}</h3>
                                {statusBadge(o)}
                            </div>
                            <p className="text-xs text-neutral-500 line-clamp-2">{o.description}</p>

                            {/* Discount */}
                            <p className="text-sm font-bold text-brand-red mt-2">
                                {o.discount_amount ? `Flat Rs. ${o.discount_amount} OFF` : o.discount_percent ? `${o.discount_percent}% OFF` : ""}
                            </p>

                            {/* Code */}
                            {o.coupon_code && (
                                <p className="text-xs font-mono tracking-widest text-brand-ink bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1 inline-block self-start">
                                    {o.coupon_code}
                                </p>
                            )}

                            {/* Distribution */}
                            <p className="text-[11px] text-neutral-400 mt-2">
                                Distribution: <span className="text-neutral-600 font-medium">{distLabel(o.distribution)}</span>
                            </p>

                            {/* Usage */}
                            {o.usage_limit != null && (
                                <p className="text-[11px] text-neutral-400 mt-0.5" data-testid={`offer-usage-${o.id}`}>
                                    Usage: <span className="text-neutral-600 font-medium">{o.usage_count} / {o.usage_limit}</span>
                                    {o.remaining_uses != null && ` · Remaining: ${o.remaining_uses}`}
                                </p>
                            )}

                            {/* Assigned customer */}
                            {o.assigned_customer_id && (
                                <p className="text-[11px] text-neutral-400 mt-0.5">Assigned customer only</p>
                            )}

                            {/* Min order */}
                            {Number(o.min_order_amount) > 0 && (
                                <p className="text-[11px] text-amber-700 mt-0.5">Min. order: Rs. {Number(o.min_order_amount).toFixed(0)}</p>
                            )}

                            {/* Expiry */}
                            {o.valid_until && (
                                <p className="text-[11px] text-neutral-400 mt-0.5">
                                    Expires: {new Date(o.valid_until).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-1 mt-auto pt-3">
                                {o.share_token && (
                                    <button onClick={() => setShareFor(o)} title="Share Voucher"
                                        data-testid={`offer-share-${o.id}`}
                                        className="w-9 h-9 rounded-full hover:bg-green-50 text-green-700 flex items-center justify-center">
                                        <Share2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => openEdit(o)} data-testid={`offer-edit-${o.id}`}
                                    className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => remove(o.id)} data-testid={`offer-delete-${o.id}`}
                                    className="w-9 h-9 rounded-full hover:bg-red-50 text-red-500 flex items-center justify-center">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ---- Create / Edit Modal ---- */}
            {editing && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <form onSubmit={save} onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[92vh] overflow-y-auto space-y-5">
                        <div className="flex justify-between items-center">
                            <h3 className="font-display font-bold text-xl text-brand-ink">{editing === "new" ? "New Offer / Voucher" : "Edit Offer"}</h3>
                            <button type="button" onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
                        </div>

                        <Section label="Offer Details">
                            <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required testid="offer-form-title" />
                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Description</label>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                                    data-testid="offer-form-description"
                                    className="w-full px-4 py-3 bg-white border border-neutral-200 focus:border-brand-red rounded-xl outline-none resize-none text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Discount %" type="number" value={form.discount_percent} onChange={(v) => setForm({ ...form, discount_percent: Number(v) })} testid="offer-form-percent" />
                                <Input label="Flat Rs. OFF" type="number" value={form.discount_amount} onChange={(v) => setForm({ ...form, discount_amount: Number(v) })} testid="offer-form-amount" />
                            </div>
                            <Input label="Min. Order (Rs.) — 0 = none" type="number" value={form.min_order_amount} onChange={(v) => setForm({ ...form, min_order_amount: Number(v) || 0 })} testid="offer-form-min-order" />
                            <Input label="Image URL (optional)" value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} testid="offer-form-image" />
                        </Section>

                        <Section label="Voucher">
                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Coupon / Voucher Code</label>
                                <div className="flex gap-2">
                                    <input type="text" value={form.coupon_code}
                                        onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })}
                                        data-testid="offer-form-code" placeholder="e.g. VIP500"
                                        className="flex-1 px-4 py-3 bg-white border border-neutral-200 focus:border-brand-red rounded-xl outline-none text-sm font-mono tracking-wider" />
                                    <button type="button" onClick={generateCode}
                                        className="px-3 py-2 rounded-xl bg-neutral-100 text-xs font-semibold hover:bg-neutral-200 whitespace-nowrap">
                                        Generate
                                    </button>
                                </div>
                            </div>
                            <Input label="Usage Limit — blank = unlimited" type="number" value={form.usage_limit} onChange={(v) => setForm({ ...form, usage_limit: v })} testid="offer-form-usage-limit" />
                            <div>
                                <label className="block text-sm font-semibold text-brand-ink mb-2">Assigned Customer (optional)</label>
                                <input type="text" value={customerSearch}
                                    onChange={(e) => searchCustomers(e.target.value)}
                                    placeholder="Type name or email to search…"
                                    data-testid="offer-form-customer-search"
                                    className="w-full px-4 py-3 bg-white border border-neutral-200 focus:border-brand-red rounded-xl outline-none text-sm" />
                                {customerResults.length > 0 && (
                                    <div className="mt-1 bg-white border border-neutral-200 rounded-xl shadow overflow-hidden">
                                        {customerResults.map((c) => (
                                            <button key={c.id || c._id} type="button"
                                                onClick={() => { setForm((f) => ({ ...f, assigned_customer_id: c.id || String(c._id) })); setCustomerSearch(c.name || c.email || ""); setCustomerResults([]); }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 text-sm border-b border-neutral-100 last:border-0">
                                                <span className="font-medium">{c.name}</span>
                                                {c.email && <span className="text-neutral-400 text-xs ml-2">{c.email}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {form.assigned_customer_id && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded flex-1 truncate">ID: {form.assigned_customer_id}</p>
                                        <button type="button" onClick={() => { setForm((f) => ({ ...f, assigned_customer_id: "" })); setCustomerSearch(""); }} className="text-xs text-red-500 hover:underline">Clear</button>
                                    </div>
                                )}
                            </div>
                        </Section>

                        <Section label="Distribution">
                            <p className="text-xs text-neutral-500 -mt-1">Where should this offer be visible?</p>
                            {[
                                { key: "website", label: "Website", hint: "Appears on /offers page" },
                                { key: "app", label: "App", hint: "Appears on app Offers screen" },
                                { key: "voucher_code_only", label: "Voucher Code Only 🔒", hint: "Private — never listed publicly, redeemable by code only" },
                            ].map(({ key, label, hint }) => (
                                <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-white">
                                    <input type="checkbox" checked={(form.distribution || []).includes(key)} onChange={() => toggleDist(key)} data-testid={`offer-dist-${key}`} className="mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-brand-ink">{label}</p>
                                        <p className="text-xs text-neutral-400">{hint}</p>
                                    </div>
                                </label>
                            ))}
                        </Section>

                        <Section label="Validity">
                            <Input label="Valid Until (blank = no expiry)" type="datetime-local" value={form.valid_until} onChange={(v) => setForm({ ...form, valid_until: v })} testid="offer-form-valid-until" />
                        </Section>

                        <Section label="Status">
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-white">
                                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} data-testid="offer-form-active" />
                                <div>
                                    <p className="text-sm font-semibold text-brand-ink">Active</p>
                                    <p className="text-xs text-neutral-400">Can this offer currently be redeemed?</p>
                                </div>
                            </label>
                        </Section>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setEditing(null)} className="flex-1 py-3 rounded-full bg-neutral-100 font-semibold text-brand-ink">Cancel</button>
                            <button type="submit" data-testid="offer-form-save" className="flex-1 py-3 rounded-full bg-brand-red text-white font-semibold hover:bg-brand-red-dark transition-colors">Save</button>
                        </div>
                    </form>
                </div>
            )}

            {/* ---- Share Modal ---- */}
            {shareFor && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShareFor(null)}>
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-display font-bold text-lg text-brand-ink">Share Voucher</h3>
                            <button onClick={() => setShareFor(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-xs text-neutral-400 uppercase font-bold tracking-widest mb-1">Voucher Code</p>
                        <p className="text-2xl font-mono font-black text-brand-ink tracking-widest mb-4">{shareFor.coupon_code || "—"}</p>
                        <p className="text-xs text-neutral-400 uppercase font-bold tracking-widest mb-1">Shareable Link</p>
                        <div className="bg-neutral-50 rounded-xl px-3 py-2 mb-4">
                            <p className="text-xs text-neutral-700 break-all">{voucherUrl(shareFor) || "No link yet — save the offer first"}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => copyLink(shareFor)} data-testid={`offer-copy-link-${shareFor.id}`}
                                className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-neutral-100 font-semibold text-brand-ink hover:bg-neutral-200">
                                <Copy className="w-4 h-4" /> Copy Link
                            </button>
                            <button onClick={() => window.open(voucherUrl(shareFor), "_blank")}
                                className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-neutral-100 font-semibold text-brand-ink hover:bg-neutral-200">
                                <ExternalLink className="w-4 h-4" /> Open Voucher Page
                            </button>
                            {shareFor.coupon_code && voucherUrl(shareFor) && (
                                <button onClick={() => whatsappShare(shareFor)} data-testid={`offer-whatsapp-${shareFor.id}`}
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-full font-semibold text-white"
                                    style={{ background: "#25D366" }}>
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.117 1.534 5.845L.057 23.5l5.794-1.52A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.905 0-3.69-.493-5.24-1.357L2 22l1.373-4.724A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                                    Send via WhatsApp
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Section({ label, children }) {
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">{label}</p>
            <div className="space-y-3 p-4 bg-neutral-50 rounded-xl">{children}</div>
        </div>
    );
}

function Input({ label, type = "text", value, onChange, required, testid }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-brand-ink mb-2">{label}</label>
            <input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} data-testid={testid}
                className="w-full px-4 py-3 bg-white border border-neutral-200 focus:border-brand-red rounded-xl outline-none text-sm" />
        </div>
    );
}