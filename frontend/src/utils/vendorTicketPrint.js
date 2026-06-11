/**
 * Auto-print vendor tickets for outsourced items
 * Called after POS order creation when vendor_tickets exist in response
 */

export function printVendorTickets(vendorTickets, settings = {}) {
  if (!vendorTickets || vendorTickets.length === 0) return;

  const rName = settings?.restaurant_name || "KARACHI NASEEB BIRYANI AND MURG PULAO";
  const rAddr = settings?.restaurant_address || "68 Chatri Chowk, Punjab Small Industry, D Block, Lahore";
  const rPhone = settings?.restaurant_phone || "+923004928411";
  const fontFamily = settings?.receipt_font_family || "Courier New";
  const baseSize = settings?.receipt_base_size || 12;
  const headerSize = settings?.receipt_header_size || 16;
  const paperWidth = settings?.receipt_paper_width || 300;
  const ff = `'${fontFamily}', monospace`;

  vendorTickets.forEach((ticket, index) => {
    // Delay each print slightly to avoid conflicts
    setTimeout(() => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.left = '-9999px';
      document.body.appendChild(iframe);

      const itemsHTML = ticket.items.map((item) =>
        `<div style="display:flex;justify-content:space-between;font-size:${baseSize}px;margin:2px 0">
          <span>${item.name}</span>
          <span>Rs ${(item.unit_price * item.quantity).toFixed(2)}</span>
        </div>
        <div style="font-size:${baseSize-1}px;padding-left:8px;color:#444">
          ${item.quantity} x Rs ${item.unit_price.toFixed(2)}
        </div>`
      ).join('');

      const html = `
        <html>
        <head>
          <title>Vendor Ticket ${ticket.ticket_no}</title>
          <style>
            body {
              font-family: ${ff};
              margin: 0;
              padding: 20px;
              font-size: ${baseSize}px;
              color: #000;
              max-width: ${paperWidth}px;
              font-weight: bold;
            }
            .center { text-align: center; }
            .line { border-top: 2px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: ${baseSize}px; }
            .highlight { background: #ffeb3b; padding: 2px 4px; font-weight: bold; }
            @media print {
              body { margin: 0; padding: 10px; }
              @page { margin: 5mm; }
            }
          </style>
        </head>
        <body>
          <div class="center">
            <h1 style="margin:4px 0;font-size:${headerSize + 2}px;font-weight:bold;text-decoration:underline">
              VENDOR TICKET
            </h1>
            <p style="margin:2px 0;font-size:${baseSize}px;font-weight:bold;background:#000;color:#fff;padding:4px">
              ${ticket.vendor_name.toUpperCase()}
            </p>
          </div>
          
          <div class="line"></div>
          
          <div class="row">
            <span>Ticket #:</span>
            <span class="highlight">${ticket.ticket_no}</span>
          </div>
          <div class="row">
            <span>Order #:</span>
            <span>${ticket.order_receipt_no}</span>
          </div>
          <div class="row">
            <span>Date:</span>
            <span>${ticket.date}</span>
          </div>
          <div class="row">
            <span>Time:</span>
            <span>${ticket.time}</span>
          </div>
          <div class="row">
            <span>Cashier:</span>
            <span>${ticket.cashier_name || "N/A"}</span>
          </div>
          
          <div class="line"></div>
          
          <div style="text-align:center;font-size:${baseSize}px;margin:4px 0;font-weight:bold;text-decoration:underline">
            OUTSOURCED ITEMS
          </div>
          
          ${itemsHTML}
          
          <div class="line"></div>
          
          <div style="display:flex;justify-content:space-between;font-size:${headerSize}px;font-weight:bold;background:#000;color:#fff;padding:4px">
            <span>TOTAL PAYABLE:</span>
            <span>Rs ${ticket.total.toFixed(2)}</span>
          </div>
          
          <div class="line" style="margin-top:12px"></div>
          
          <div class="center" style="font-size:${baseSize-1}px;margin-top:8px">
            <p style="margin:2px 0">From: ${rName}</p>
            <p style="margin:2px 0">${rAddr}</p>
            <p style="margin:2px 0">Tel: ${rPhone}</p>
            <p style="margin:6px 0 0 0;font-weight:bold">*** VENDOR COPY - NOT FOR CUSTOMER ***</p>
          </div>
        </body>
        </html>
      `;

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          
          // Clean up iframe after print
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        } catch (e) {
          console.error('Failed to print vendor ticket:', e);
          document.body.removeChild(iframe);
        }
      }, 300);
    }, index * 500); // Delay each ticket by 500ms
  });
}
