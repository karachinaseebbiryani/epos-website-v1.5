import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";
import { API } from "../lib/api";

/**
 * 80mm thermal receipt with two QR codes (location + review).
 * Rendered via createPortal directly under document.body so the print stylesheet
 * (`body > *:not(.receipt-print) { display: none }`) cleanly hides the rest of the page.
 */
export default function ThermalReceipt({ order, visible = false }) {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        let cancelled = false;
        axios.get(`${API}/public/restaurant-info`).then(({ data }) => {
            if (!cancelled) setInfo(data);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    if (!order) return null;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const reviewUrl = `${origin}/review/${order.id}`;
    const mapsUrl = info?.google_maps_url || "https://maps.google.com/";

    const subtotal = Number(order.subtotal ?? order.items?.reduce((s, i) => s + (i.price * i.quantity), 0) ?? 0);
    const discount = Number(order.discount_amount || 0);
    const delivery = Number(order.delivery_fee || 0);
    const total = Number(order.total_price ?? subtotal - discount + delivery);

    const dateStr = order.created_at ? new Date(order.created_at).toLocaleString() : "";
    const cur = info?.currency || "Rs";

    const wrapperStyle = visible
        ? { width: "80mm", margin: "0 auto", background: "#fff", color: "#000", border: "1px dashed #999", padding: "2mm 3mm", fontFamily: "'Courier New', monospace", fontSize: 12, lineHeight: 1.35 }
        : { display: "none" };

    const node = (
        <div className="receipt-print" style={wrapperStyle} data-testid="thermal-receipt">
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "4px" }}>
                <div style={{ fontWeight: 900, fontSize: "14px", letterSpacing: "0.5px" }}>
                    {info?.name || "KARACHI NASEEB BIRYANI"}
                </div>
                <div style={{ fontSize: "11px" }}>{info?.address || "68 Chatri Chowk, Lahore"}</div>
                <div style={{ fontSize: "11px" }}>Tel: {info?.phone || "+92 300 4928411"}</div>
            </div>

            <Hr />

            {/* Order meta */}
            <Row label="Order #" value={order.receipt_no || (order.id || "").slice(-6).toUpperCase()} bold />
            <Row label="Date" value={dateStr} />
            {order.cashier_name && <Row label="Cashier" value={order.cashier_name} />}
            {order.customer_name && <Row label="Customer" value={order.customer_name} />}
            {order.phone && <Row label="Phone" value={order.phone} />}
            {order.address && (
                <div style={{ fontSize: "11px", wordBreak: "break-word" }}>
                    <strong>Address:</strong> {order.address}
                </div>
            )}
            {order.notes && (
                <div style={{ fontSize: "11px", wordBreak: "break-word", marginTop: "2px" }}>
                    <strong>Notes:</strong> {order.notes}
                </div>
            )}
            {order.modified && (
                <div style={{ fontSize: "11px", textAlign: "center", marginTop: "2px" }}>
                    *** ORDER MODIFIED ***
                </div>
            )}

            <Hr />

            {/* Items header */}
            <div style={{ display: "flex", fontWeight: 700, fontSize: "11px" }}>
                <span style={{ flex: "1 1 auto" }}>ITEM</span>
                <span style={{ width: "10mm", textAlign: "right" }}>QTY</span>
                <span style={{ width: "16mm", textAlign: "right" }}>AMOUNT</span>
            </div>
            <Hr dotted />

            {/* Items rows — wrap names that exceed available width */}
            {(order.items || []).map((it, idx) => {
                const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 0);
                return (
                    <div key={idx} style={{ marginBottom: "1.5mm" }}>
                        <div style={{ display: "flex", alignItems: "flex-start" }}>
                            <span style={{ flex: "1 1 auto", wordBreak: "break-word", paddingRight: "1mm" }}>{it.name}</span>
                            <span style={{ width: "10mm", textAlign: "right" }}>{it.quantity}</span>
                            <span style={{ width: "16mm", textAlign: "right" }}>{lineTotal.toFixed(0)}</span>
                        </div>
                        {Number(it.price) > 0 && Number(it.quantity) > 1 && (
                            <div style={{ fontSize: "10px", color: "#000", paddingLeft: "1mm" }}>
                                @ {cur} {Number(it.price).toFixed(0)}
                            </div>
                        )}
                    </div>
                );
            })}

            <Hr />

            {/* Totals */}
            <Row label="Subtotal" value={`${cur} ${subtotal.toFixed(0)}`} />
            {discount > 0 && <Row label="Discount" value={`- ${cur} ${discount.toFixed(0)}`} />}
            {delivery > 0 && <Row label="Delivery" value={`${cur} ${delivery.toFixed(0)}`} />}
            <div style={{ marginTop: "2px", paddingTop: "2px", borderTop: "1px dashed #000" }}>
                <Row label="TOTAL" value={`${cur} ${total.toFixed(0)}`} bold size={14} />
            </div>
            {order.payment_method && (
                <div style={{ fontSize: "11px", marginTop: "2px" }}>
                    Payment: <strong>{String(order.payment_method).toUpperCase()}</strong>
                    {order.payment_status && order.payment_status !== "pending" && (
                        <> · <strong>{String(order.payment_status).replace(/_/g, " ").toUpperCase()}</strong></>
                    )}
                </div>
            )}

            <Hr />

            {/* QR codes */}
            <div style={{ display: "flex", justifyContent: "space-around", gap: "2mm", margin: "2mm 0" }}>
                <QrBlock label="Find Us" caption="Tap to open Google Maps" value={mapsUrl} />
                <QrBlock label="Rate Order" caption="Scan to leave a review" value={reviewUrl} />
            </div>

            <div style={{ textAlign: "center", marginTop: "2mm", fontSize: "11px" }}>
                Thank you for your order!
            </div>
            <div style={{ textAlign: "center", fontSize: "10px", marginTop: "1mm" }}>
                {origin.replace(/^https?:\/\//, "")}
            </div>
        </div>
    );

    if (typeof document === "undefined") return null;
    return createPortal(node, document.body);
}

function QrBlock({ label, caption, value }) {
    return (
        <div style={{ textAlign: "center", flex: "1 1 30mm", maxWidth: "32mm" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, marginBottom: "1mm" }}>{label}</div>
            <QRCodeSVG value={value} size={108} level="M" includeMargin={false} />
            <div style={{ fontSize: "9px", marginTop: "1mm", lineHeight: 1.2, wordBreak: "break-word" }}>{caption}</div>
        </div>
    );
}

function Row({ label, value, bold, size }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: size || 12, fontWeight: bold ? 700 : 400 }}>
            <span>{label}</span>
            <span style={{ textAlign: "right" }}>{value}</span>
        </div>
    );
}

function Hr({ dotted = false }) {
    return <div style={{ borderTop: `1px ${dotted ? "dotted" : "dashed"} #000`, margin: "3px 0" }} />;
}
