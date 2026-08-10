import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";

/**
 * VoucherPage — renders the voucher when a real user taps the /v/:shareToken link.
 * WhatsApp/social crawlers are served the server-rendered HTML from the backend
 * (Vercel proxies /v/* to the backend) so OG tags work without JS. Real users who
 * click through land on this page for the interactive copy/order experience.
 */
export default function VoucherPage() {
    const { shareToken } = useParams();
    const [voucher, setVoucher] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        api.get(`/public/voucher/${shareToken}`)
            .then(({ data }) => setVoucher(data))
            .catch(() => setVoucher(null))
            .finally(() => setLoading(false));
    }, [shareToken]);

    const copyCode = () => {
        if (!voucher?.coupon_code) return;
        navigator.clipboard.writeText(voucher.coupon_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    if (loading) return (
        <div style={{ minHeight: "100vh", background: "#155E3F", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#FEC902", fontSize: 14 }}>Loading…</div>
        </div>
    );

    if (!voucher) return (
        <div style={{ minHeight: "100vh", background: "#155E3F", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 24, padding: "40px 32px", textAlign: "center", maxWidth: 400, width: "100%" }}>
                <p style={{ fontSize: 48, margin: 0 }}>🤔</p>
                <h1 style={{ color: "#1A1D1A", margin: "12px 0 8px", fontFamily: "system-ui,sans-serif" }}>Voucher Not Found</h1>
                <p style={{ color: "#5C5F5C", fontSize: 14 }}>This voucher link is invalid or has been removed.</p>
                <Link to="/menu" style={{ display: "inline-block", marginTop: 20, background: "#155E3F", color: "#fff", padding: "14px 28px", borderRadius: 30, textDecoration: "none", fontWeight: "bold", fontSize: 14 }}>
                    Order Online
                </Link>
            </div>
        </div>
    );

    const status = voucher.computed_status;
    const isActive = status === "ACTIVE";

    const discTxt = voucher.discount_amount
        ? `Rs. ${Number(voucher.discount_amount).toFixed(0)} OFF`
        : voucher.discount_percent
            ? `${voucher.discount_percent}% OFF`
            : "Special Offer";

    const validStr = voucher.valid_until
        ? new Date(voucher.valid_until).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })
        : null;

    let statusBanner = null;
    if (status === "FULLY_REDEEMED") {
        statusBanner = <Banner color="#C41E3A" icon="🚫" title="Voucher Fully Redeemed" sub="This voucher is no longer available." />;
    } else if (status === "EXPIRED") {
        statusBanner = <Banner color="#C41E3A" icon="⌛" title="Voucher Expired" sub={validStr ? `This voucher expired on ${validStr}.` : "This voucher has expired."} />;
    } else if (status === "INACTIVE") {
        statusBanner = <Banner color="#888" icon="⛔" title="Voucher Unavailable" sub="This voucher is currently inactive." />;
    }

    return (
        <div style={{ minHeight: "100vh", background: "#155E3F", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
            <div style={{ background: "#fff", borderRadius: 24, maxWidth: 440, width: "100%", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                {/* Header */}
                <div style={{ background: "#155E3F", padding: "24px 24px 20px", textAlign: "center" }}>
                    <div style={{ width: 52, height: 52, background: "#C41E3A", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 10 }}>K</div>
                    <p style={{ color: "#FEC902", fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: 0, textTransform: "uppercase" }}>Karachi Naseeb Biryani</p>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: "4px 0 0" }}>🎁 Special Voucher</p>
                </div>

                {/* Body */}
                <div style={{ padding: "28px 24px" }}>
                    {statusBanner}

                    <div style={{ textAlign: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 52, fontWeight: 900, color: "#155E3F", lineHeight: 1 }}>{discTxt}</div>
                        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1D1A", margin: "8px 0 4px" }}>{voucher.title}</h1>
                        {voucher.description && <p style={{ color: "#5C5F5C", fontSize: 14, margin: 0 }}>{voucher.description}</p>}
                    </div>

                    {/* Code + actions */}
                    {isActive && voucher.coupon_code && (
                        <div style={{ textAlign: "center", margin: "24px 0" }}>
                            <p style={{ color: "#5C5F5C", fontSize: 12, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>Voucher Code</p>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#F9F8F6", border: "2px dashed #FEC902", borderRadius: 12, padding: "14px 24px" }}>
                                <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: 3, color: "#1A1D1A", fontFamily: "monospace" }}>{voucher.coupon_code}</span>
                                <button onClick={copyCode}
                                    style={{ background: "#FEC902", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: "bold", cursor: "pointer", fontSize: 13, transition: "opacity .2s" }}>
                                    {copied ? "✓ Copied!" : "Copy"}
                                </button>
                            </div>
                            <p style={{ color: "#5C5F5C", fontSize: 12, margin: "8px 0 0" }}>Enter this code at checkout</p>
                        </div>
                    )}

                    {/* Details */}
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                            {voucher.min_order_amount > 0 && <DetailRow label="Minimum Order" value={`Rs. ${Number(voucher.min_order_amount).toFixed(0)}`} />}
                            {validStr && <DetailRow label="Valid Until" value={validStr} />}
                            {voucher.remaining_uses != null && <DetailRow label="Remaining Uses" value={String(voucher.remaining_uses)} />}
                        </tbody>
                    </table>

                    {isActive && (
                        <div style={{ textAlign: "center", marginTop: 24 }}>
                            <Link to="/menu" style={{ display: "inline-block", background: "#155E3F", color: "#fff", padding: "16px 40px", borderRadius: 30, textDecoration: "none", fontWeight: "bold", fontSize: 16 }}>
                                🍽️ Order Now
                            </Link>
                        </div>
                    )}
                </div>

                <div style={{ padding: "16px 24px", background: "#F9F8F6", textAlign: "center", borderTop: "1px solid #E5E2DC" }}>
                    <p style={{ margin: 0, color: "#5C5F5C", fontSize: 11 }}>Karachi Naseeb Biryani &amp; Murg Pulao · 68 Chatri Chowk, D Block, Lahore</p>
                </div>
            </div>
        </div>
    );
}

function Banner({ color, icon, title, sub }) {
    return (
        <div style={{ background: color, color: "#fff", padding: 18, borderRadius: 12, textAlign: "center", fontWeight: "bold", fontSize: 17, marginBottom: 20 }}>
            {icon} {title}
            {sub && <div style={{ fontSize: 13, fontWeight: "normal", marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <tr>
            <td style={{ color: "#5C5F5C", padding: "6px 0", fontSize: 13 }}>{label}</td>
            <td style={{ fontWeight: 600, textAlign: "right", fontSize: 13 }}>{value}</td>
        </tr>
    );
}
