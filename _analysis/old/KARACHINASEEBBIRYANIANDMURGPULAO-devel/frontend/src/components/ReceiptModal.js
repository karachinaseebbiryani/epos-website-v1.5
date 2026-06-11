import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Printer, X } from "lucide-react";

export default function ReceiptModal({ open, onClose, order, settings, currency = "Rs" }) {
  const iframeRef = useRef(null);
  if (!order) return null;
  const dt = order.created_at ? new Date(order.created_at) : new Date();
  const rName = settings?.restaurant_name || "KARACHI NASEEB BIRYANI AND MURG PULAO";
  const rAddr = settings?.restaurant_address || "68 Chatri Chowk, Punjab Small Industry, D Block, Lahore";
  const rPhone = settings?.restaurant_phone || "+923004928411";
  const rEmail = settings?.restaurant_email || "";
  const rLogo = settings?.restaurant_logo || "";
  const c = currency;
  const labels = { cash: "CASH", credit: "CARD", foodpanda1: "FOODPANDA 1", foodpanda2: "FOODPANDA 2" };

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

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const itemsHTML = order.items?.map((item) =>
      `<div style="display:flex;justify-content:space-between;font-size:${baseSize}px"><span>${item.name}</span><span>${c} ${(item.price*item.quantity).toFixed(2)}</span></div><div style="font-size:${baseSize-1}px;padding-left:8px;color:#444">${item.quantity} x ${c} ${item.price.toFixed(2)}</div>`
    ).join("") || "";
    const html = `<html><head><title>Receipt</title><style>body{font-family:${ff};margin:0;padding:20px;font-size:${baseSize}px;color:#000;max-width:${paperWidth}px;font-weight:${fontWeightAll}}.center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:2px 0;font-size:${baseSize}px}@media print{body{margin:0;padding:10px}@page{margin:5mm}}</style></head><body>
      <div class="center">${rLogo ? `<img src="${rLogo}" alt="logo" style="max-width:80px;max-height:80px;margin:0 auto 4px;display:block"/>` : ""}<h2 style="margin:4px 0;font-size:${headerSize}px;font-weight:bold">${rName}</h2><p style="margin:2px 0;font-size:${baseSize-2}px">${rAddr}</p><p style="margin:2px 0;font-size:${baseSize-2}px">Tel: ${rPhone}</p>${rEmail ? `<p style="margin:2px 0;font-size:${baseSize-3}px">${rEmail}</p>` : ""}</div><div class="line"></div>
      <div class="row"><span>Receipt #:</span><span style="font-weight:bold">${order.id?.slice(-6)?.toUpperCase() || "------"}</span></div>
      <div class="row"><span>Date:</span><span>${dt.toLocaleDateString()}</span></div><div class="row"><span>Time:</span><span>${dt.toLocaleTimeString()}</span></div>
      <div class="row"><span>Cashier:</span><span>${order.cashier_name || "N/A"}</span></div>
      <div class="row"><span>Payment:</span><span style="font-weight:bold">${labels[order.payment_type] || order.payment_type?.toUpperCase()}</span></div><div class="line"></div>
      ${itemsHTML}<div class="line"></div>
      <div class="row"><span>Subtotal:</span><span>${c} ${order.subtotal?.toFixed(2)}</span></div>
      ${order.discount_amount > 0 ? `<div class="row"><span>Discount:</span><span>-${c} ${order.discount_amount?.toFixed(2)}</span></div>` : ""}
      ${showTax ? `<div class="row"><span>Tax:</span><span>${c} ${order.tax?.toFixed(2)}</span></div>` : ""}<div class="line"></div>
      <div style="display:flex;justify-content:space-between;font-size:${totalSize}px;font-weight:${fontWeightTotal}"><span>TOTAL:</span><span>${c} ${order.total?.toFixed(2)}</span></div>
      <div class="line" style="margin-top:12px"></div><div class="center" style="font-size:${baseSize-1}px"><p>${footerText}</p></div>
    </body></html>`;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-[#E5E2DC] max-w-md">
        <DialogHeader><DialogTitle style={{ fontFamily: "Manrope" }}>Order Receipt</DialogTitle><DialogDescription>Review and print</DialogDescription></DialogHeader>
        <iframe ref={iframeRef} title="receipt-print" style={{ position: "absolute", width: 0, height: 0, border: "none", left: "-9999px" }} />
        <div className="rounded-lg border border-[#E5E2DC] p-4 bg-white" style={{ fontFamily: ff, fontSize: `${baseSize}px`, fontWeight: fontWeightAll }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Cashier:</span><span>{order.cashier_name || "N/A"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Payment:</span><span style={{ fontWeight: "bold" }}>{labels[order.payment_type] || order.payment_type?.toUpperCase()}</span></div>
          <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          {order.items?.map((item, idx) => (
            <div key={idx}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px` }}><span>{item.name}</span><span>{c} {(item.price * item.quantity).toFixed(2)}</span></div>
              <div style={{ fontSize: `${baseSize-1}px`, paddingLeft: "8px", color: "#666" }}>{item.quantity} x {c} {item.price.toFixed(2)}</div>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Subtotal:</span><span>{c} {order.subtotal?.toFixed(2)}</span></div>
          {order.discount_amount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Discount:</span><span>-{c} {order.discount_amount?.toFixed(2)}</span></div>}
          {showTax && <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${baseSize}px`, marginBottom: "2px" }}><span>Tax:</span><span>{c} {order.tax?.toFixed(2)}</span></div>}
          <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${totalSize}px`, fontWeight: fontWeightTotal }}><span>TOTAL:</span><span>{c} {order.total?.toFixed(2)}</span></div>
          <div style={{ borderTop: "1px dashed #999", margin: "12px 0" }} />
          <div style={{ textAlign: "center", fontSize: `${baseSize-1}px` }}>{footerText}</div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button data-testid="print-receipt-btn" onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><Printer className="w-4 h-4" /> Print Receipt</Button>
          <Button data-testid="close-receipt-btn" onClick={() => onClose(false)} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]"><X className="w-4 h-4" /> Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
