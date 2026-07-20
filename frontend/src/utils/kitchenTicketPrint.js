/**
 * Print a KITCHEN ticket for an order — items + quantities + any "no <ingredient>"
 * removal instructions. Prices are intentionally hidden: the kitchen only needs to
 * know WHAT to cook and WHAT to leave out, not the money.
 *
 * Works for both POS orders (items with removed_ingredients) and online orders.
 * Removals are highlighted so the line cook can't miss an allergy request.
 *
 * Ported from the Marhaba project; the only adaptation is the fallback name —
 * KNB has no config/brand module, so the restaurant name comes from settings
 * with a hardcoded fallback.
 */
const FALLBACK_NAME = "KARACHI NASEEB BIRYANI AND MURG PULAO";

export function printKitchenTicket(order, settings = {}) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) return;

  const rName = settings?.restaurant_name || FALLBACK_NAME;
  const fontFamily = settings?.receipt_font_family || "Courier New";
  const baseSize = settings?.receipt_base_size || 12;
  const headerSize = settings?.receipt_header_size || 16;
  const paperWidth = settings?.receipt_paper_width || 300;
  const ff = `'${fontFamily}', monospace`;

  const receiptNo = order.receipt_no || (order.id || "").slice(-6).toUpperCase() || "------";
  const dt = order.created_at ? new Date(order.created_at) : new Date();
  const orderType = order.table_name
    ? `TABLE ${order.table_name}`
    : (order.customer_name || order.address) ? "ONLINE" : "COUNTER";

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const itemsHTML = order.items.map((item) => {
    const removed = Array.isArray(item.removed_ingredients) ? item.removed_ingredients.filter(Boolean) : [];
    const removalHTML = removed.length
      ? `<div style="margin:2px 0 4px 10px;font-size:${baseSize}px">
           ${removed.map((r) => `<div class="removal">✗ NO ${esc(r).toUpperCase()}</div>`).join("")}
         </div>`
      : "";
    return `
      <div style="margin:6px 0">
        <div style="display:flex;justify-content:space-between;font-size:${baseSize + 2}px;font-weight:bold">
          <span>${esc(item.name)}</span>
          <span style="white-space:nowrap">x ${Number(item.quantity) || 1}</span>
        </div>
        ${removalHTML}
      </div>`;
  }).join("");

  const html = `
    <html>
    <head>
      <title>Kitchen Ticket ${esc(receiptNo)}</title>
      <style>
        body { font-family: ${ff}; margin: 0; padding: 20px; font-size: ${baseSize}px; color: #000; max-width: ${paperWidth}px; font-weight: bold; }
        .center { text-align: center; }
        .line { border-top: 2px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: ${baseSize}px; }
        .removal { background: #000; color: #fff; padding: 2px 4px; margin: 2px 0; font-weight: bold; display: inline-block; }
        @media print { body { margin: 0; padding: 10px; } @page { margin: 5mm; } }
      </style>
    </head>
    <body>
      <div class="center">
        <h1 style="margin:4px 0;font-size:${headerSize + 2}px;font-weight:bold;text-decoration:underline">KITCHEN</h1>
        <p style="margin:2px 0;font-size:${baseSize}px;font-weight:bold;background:#000;color:#fff;padding:4px">${esc(rName)}</p>
      </div>
      <div class="line"></div>
      <div class="row"><span>Order #:</span><span>${esc(receiptNo)}</span></div>
      <div class="row"><span>Type:</span><span>${orderType}</span></div>
      <div class="row"><span>Time:</span><span>${dt.toLocaleTimeString()}</span></div>
      ${order.customer_name ? `<div class="row"><span>Customer:</span><span>${esc(order.customer_name)}</span></div>` : ""}
      ${order.cashier_name ? `<div class="row"><span>Cashier:</span><span>${esc(order.cashier_name)}</span></div>` : ""}
      <div class="line"></div>
      <div style="text-align:center;font-size:${baseSize}px;margin:4px 0;font-weight:bold;text-decoration:underline">ITEMS TO PREPARE</div>
      ${itemsHTML}
      ${order.notes ? `<div class="line"></div><div style="font-size:${baseSize}px"><strong>Notes:</strong> ${esc(order.notes)}</div>` : ""}
      <div class="line" style="margin-top:12px"></div>
      <div class="center" style="font-size:${baseSize - 1}px;margin-top:8px">
        <p style="margin:6px 0 0 0;font-weight:bold">*** KITCHEN COPY — NO PRICES ***</p>
      </div>
    </body>
    </html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.left = "-9999px";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    } catch (e) {
      console.error("Failed to print kitchen ticket:", e);
      try { document.body.removeChild(iframe); } catch { /* */ }
    }
  }, 300);
}
