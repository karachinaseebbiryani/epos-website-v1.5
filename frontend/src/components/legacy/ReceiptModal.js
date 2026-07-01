import React, { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Printer, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";

export default function ReceiptModal({ open, onClose, order, settings, currency = "Rs" }) {
  const iframeRef = useRef(null);
  const previewRef = useRef(null); // V2: used to scrape the rendered QR SVGs for print
  const [restaurantInfo, setRestaurantInfo] = useState(null);
  
  useEffect(() => {
    // Fetch restaurant info for QR codes
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/public/restaurant-info`)
      .then(({ data }) => setRestaurantInfo(data))
      .catch(() => {});
  }, []);
  
  if (!order) return null;
  const dt = order.created_at ? new Date(order.created_at) : new Date();
  const rName = settings?.restaurant_name || "KARACHI NASEEB BIRYANI AND MURG PULAO";
  const rAddr = settings?.restaurant_address || "68 Chatri Chowk, Punjab Small Industry, D Block, Lahore";
  const rPhone = settings?.restaurant_phone || "+923004928411";
  const rEmail = settings?.restaurant_email || "";
  const [rLogo, setRLogo] = React.useState(settings?.restaurant_logo || "");
  React.useEffect(() => {
    if (rLogo) return; // already have it (either inline or fetched)
    // Lazy-load the logo from the small dedicated endpoint
    const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
    let cancelled = false;
    fetch(`${API}/settings/logo`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : { restaurant_logo: "" })
      .then((d) => { if (!cancelled) setRLogo(d.restaurant_logo || ""); })
      .catch(() => { /* ignore — receipt just prints without logo */ });
    return () => { cancelled = true; };
  }, [rLogo]);
  const c = currency;
  const labels = { cash: "CASH", credit: "CARD", foodpanda1: "FOODPANDA 1", foodpanda2: "FOODPANDA 2", cod: "COD", pay_at_restaurant: "PAY AT RESTAURANT", bank_transfer: "BANK TRANSFER", card: "CARD" };

  // Normalize fields so ReceiptModal works for BOTH POS orders (uses `total`, `payment_type`)
  // and Online orders (uses `total_price`, `payment_method`, `delivery_fee`, `customer_name`, etc.).
  const orderTotal = (order.total != null) ? order.total : order.total_price;
  const orderPayment = order.payment_type || order.payment_method;
  const orderSubtotal = order.subtotal != null ? order.subtotal : (order.items || []).reduce((s, it) => s + (it.price * it.quantity), 0);
  const deliveryFee = Number(order.delivery_fee || 0);
  const isOnline = !!(order.customer_name || order.address || order.delivery_fee);

  // Receipt formatting (with sane defaults)
  const fontFamily = settings?.receipt_font_family || "Courier New";
  const baseSize = settings?.receipt_base_size || 12;
  const headerSize = settings?.receipt_header_size || 16;
  const totalSize = settings?.receipt_total_size || 16;
  const boldAll = !!settings?.receipt_bold_all;
  const boldTotal = settings?.receipt_bold_total !== false;
  const showTax = settings?.receipt_show_tax_line !== false;
  const footerText = settings?.receipt_footer_text || "Thank you for your order!";
  const paperWidth = settings?.receipt_paper_width || 300;
  const fontWeightAll = boldAll ? "bold" : "normal";
  const fontWeightTotal = boldTotal ? "bold" : "normal";
  const ff = `'${fontFamily}', monospace`;
  
  // QR code settings (configurable, default enabled)
  const enableQRCodes = settings?.enable_receipt_qr_codes !== false;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const mapsUrl = restaurantInfo?.google_maps_url || "https://maps.google.com/";
  const reviewUrl = `${origin}/review/${order.id}`;

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const itemsHTML = order.items?.map((item) =>
      `<div style="display:flex;justify-content:space-between;font-size:${baseSize}px"><span>${item.name}</span><span>${c} ${(item.price*item.quantity).toFixed(2)}</span></div><div style="font-size:${baseSize-1}px;padding-left:8px;color:#444">${item.quantity} x ${c} ${item.price.toFixed(2)}</div>`
    ).join("") || "";
    
    // QR codes HTML (if enabled). V2 fix: previously the print iframe only wrote text URLs and
    // skipped the actual QR images. We now serialize the rendered <QRCodeSVG/> nodes from the
    // visible preview into the print document so the scan codes actually appear on paper / PDF.
    const serializeQrSvg = (selector) => {
      try {
        const node = previewRef.current?.querySelector(selector);
        if (!node) return "";
        const xml = new XMLSerializer().serializeToString(node);
        // strip width/height so we can size deterministically in print CSS
        return xml.replace(/\swidth="\d+"/, ' width="110"').replace(/\sheight="\d+"/, ' height="110"');
      } catch { return ""; }
    };
    const findUsQrXml = serializeQrSvg('[data-print-qr="find-us"]');
    const reviewQrXml = serializeQrSvg('[data-print-qr="review"]');
    const qrCodesHTML = (enableQRCodes && (findUsQrXml || reviewQrXml)) ? `
      <div class="line"></div>
      <div style="display:flex;justify-content:space-around;gap:8px;margin:8px 0">
        <div style="text-align:center;flex:1">
          <div style="font-size:${baseSize-2}px;font-weight:bold;margin-bottom:4px">Find Us</div>
          ${findUsQrXml || ""}
          <div style="font-size:${baseSize-3}px;margin-top:4px">Open Google Maps</div>
        </div>
        <div style="text-align:center;flex:1">
          <div style="font-size:${baseSize-2}px;font-weight:bold;margin-bottom:4px">Rate Order</div>
          ${reviewQrXml || ""}
          <div style="font-size:${baseSize-3}px;margin-top:4px">Leave a Review</div>
        </div>
      </div>
    ` : "";
    
    const html = `<html><head><title>Receipt</title><style>body{font-family:${ff};margin:0;padding:20px;font-size:${baseSize}px;color:#000;max-width:${paperWidth}px;font-weight:${fontWeightAll}}.center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:2px 0;font-size:${baseSize}px}@media print{body{margin:0;padding:10px}@page{margin:5mm}}</style></head><body>
      <div class="center">${rLogo ? `<img src="${rLogo}" alt="logo" style="max-width:80px;max-height:80px;margin:0 auto 4px;display:block"/>` : ""}<h2 style="margin:4px 0;font-size:${headerSize}px;font-weight:bold">${rName}</h2><p style="margin:2px 0;font-size:${baseSize-2}px">${rAddr}</p><p style="margin:2px 0;font-size:${baseSize-2}px">Tel: ${rPhone}</p>${rEmail ? `<p style="margin:2px 0;font-size:${baseSize-3}px">${rEmail}</p>` : ""}</div><div class="line"></div>
      <div class="row"><span>Receipt #:</span><span style="font-weight:bold">${order.id?.slice(-6)?.toUpperCase() || "------"}</span></div>
      <div class="row"><span>Date:</span><span>${dt.toLocaleDateString()}</span></div><div class="row"><span>Time:</span><span>${dt.toLocaleTimeString()}</span></div>
      ${isOnline ? "" : `<div class="row"><span>Cashier:</span><span>${order.cashier_name || "N/A"}</span></div>`}
      ${isOnline && order.customer_name ? `<div class="row"><span>Customer:</span><span>${order.customer_name}</span></div>` : ""}
      ${isOnline && order.phone ? `<div class="row"><span>Phone:</span><span>${order.phone}</span></div>` : ""}
      ${isOnline && order.address ? `<div style="font-size:${baseSize-1}px;margin:2px 0;word-break:break-word"><strong>Address:</strong> ${order.address}</div>` : ""}
      <div class="row"><span>Payment:</span><span style="font-weight:bold">${labels[orderPayment] || (orderPayment || "").toUpperCase()}</span></div><div class="line"></div>
      ${itemsHTML}<div class="line"></div>
      <div class="row"><span>Subtotal:</span><span>${c} ${Number(orderSubtotal).toFixed(2)}</span></div>
      ${order.discount_amount > 0 ? `<div class="row"><span>Discount:</span><span>-${c} ${order.discount_amount?.toFixed(2)}</span></div>` : ""}
      ${deliveryFee > 0 ? `<div class="row"><span>Delivery:</span><span>${c} ${deliveryFee.toFixed(2)}</span></div>` : ""}
      ${showTax && order.tax != null ? `<div class="row"><span>Tax:</span><span>${c} ${order.tax?.toFixed(2)}</span></div>` : ""}<div class="line"></div>
      <div style="display:flex;justify-content:space-between;font-size:${totalSize}px;font-weight:${fontWeightTotal}"><span>TOTAL:</span><span>${c} ${Number(orderTotal || 0).toFixed(2)}</span></div>
      ${qrCodesHTML}
      <div class="line" style="margin-top:12px"></div><div class="center" style="font-size:${baseSize-1}px"><p>${footerText}</p></div>
    </body></html>`;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-[#E5E2DC] max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle style={{ fontFamily: "Manrope" }}>Order Receipt</DialogTitle>
          <DialogDescription>Review and print</DialogDescription>
        </DialogHeader>
        <iframe ref={iframeRef} title="receipt-print" style={{ position: "absolute", width: 0, height: 0, border: "none", left: "-9999px" }} />
        <div className="flex-1 min-h-0 overflow-y-auto px-6" data-testid="receipt-scroll-body">
          <div ref={previewRef} className="rounded-lg border border-[#E5E2DC] p-4 bg-white" style={{ fontFamily: ff, fontSize: `${baseSize}px`, fontWeight: fontWeightAll }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            {rLogo ? <img src={rLogo} alt="logo" style={{ maxWidth: "80px", maxHeight: "80px", margin: "0 auto 4px", display: "block" }} /> : null}
            <h2 style={{ margin: "4px 0", fontSize: `${headerSize}px`, fontWeight: "bold" }}>{rName}</h2>
            <p style={{ margin: "2px 0", fontSize: `${baseSize-2}px` }}>{rAddr}</p>
            <p style={{ margin: "2px 0", fontSize: `${baseSize-2}px` }}>Tel: {rPhone}</p>
            {rEmail && <p style={{ margin: "2px 0", fontSize: `${baseSize-3}px` }}>{rEmail}</p>}
            <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Receipt #:</span><span style={{ fontWeight: "bold" }}>{order.id?.slice(-6)?.toUpperCase()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Date:</span><span>{dt.toLocaleDateString()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Time:</span><span>{dt.toLocaleTimeString()}</span></div>
          {!isOnline && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Cashier:</span><span>{order.cashier_name || "N/A"}</span></div>
          )}
          {isOnline && order.customer_name && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Customer:</span><span>{order.customer_name}</span></div>
          )}
          {isOnline && order.phone && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Phone:</span><span>{order.phone}</span></div>
          )}
          {isOnline && order.address && (
            <div style={{ fontSize: `${baseSize-1}px`, margin: "2px 0", wordBreak: "break-word" }}><strong>Address:</strong> {order.address}</div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Payment:</span><span style={{ fontWeight: "bold" }}>{labels[orderPayment] || (orderPayment || "").toUpperCase()}</span></div>
          <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          {order.items?.map((item, idx) => (
            <div key={idx}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px` }}><span>{item.name}</span><span>{c} {(item.price * item.quantity).toFixed(2)}</span></div>
              <div style={{ fontSize: `${baseSize-1}px`, paddingLeft: "8px", color: "#666" }}>{item.quantity} x {c} {item.price.toFixed(2)}</div>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Subtotal:</span><span>{c} {Number(orderSubtotal).toFixed(2)}</span></div>
          {order.discount_amount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Discount:</span><span>-{c} {order.discount_amount?.toFixed(2)}</span></div>}
          {deliveryFee > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Delivery:</span><span>{c} {deliveryFee.toFixed(2)}</span></div>}
          {showTax && order.tax != null && <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Tax:</span><span>{c} {order.tax?.toFixed(2)}</span></div>}
          <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${totalSize}px`, fontWeight: fontWeightTotal }}><span>TOTAL:</span><span>{c} {Number(orderTotal || 0).toFixed(2)}</span></div>
          
          {/* QR Codes Section */}
          {enableQRCodes && restaurantInfo && (
            <>
              <div style={{ borderTop: "1px dashed #999", margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-around", gap: "8px", margin: "12px 0" }}>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: `${baseSize-2}px`, fontWeight: "bold", marginBottom: "4px" }}>🗺️ Find Us</div>
                  <QRCodeSVG value={mapsUrl} size={100} level="M" data-print-qr="find-us" />
                  <div style={{ fontSize: `${baseSize-3}px`, marginTop: "4px" }}>Google Maps</div>
                </div>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: `${baseSize-2}px`, fontWeight: "bold", marginBottom: "4px" }}>⭐ Rate Order</div>
                  <QRCodeSVG value={reviewUrl} size={100} level="M" data-print-qr="review" />
                  <div style={{ fontSize: `${baseSize-3}px`, marginTop: "4px" }}>Leave a Review</div>
                </div>
              </div>
            </>
          )}
          
          <div style={{ borderTop: "1px dashed #999", margin: "12px 0" }} />
          <div style={{ textAlign: "center", fontSize: `${baseSize-1}px` }}>{footerText}</div>
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-[#E5E2DC] flex-shrink-0 bg-white" data-testid="receipt-actions">
          <Button data-testid="print-receipt-btn" onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><Printer className="w-4 h-4" /> Print Receipt</Button>
          <Button data-testid="close-receipt-btn" onClick={() => onClose(false)} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]"><X className="w-4 h-4" /> Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
