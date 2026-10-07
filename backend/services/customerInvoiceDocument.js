const PDFDocument = require('pdfkit');
const path = require('path');

const formatMoney = value => `Rs. ${Number(value || 0).toLocaleString('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const formatInvoiceDate = value => new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric'
}).format(value ? new Date(value) : new Date());

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const getInvoiceNumber = invoice => `INV-${String(invoice._id || '').slice(-8).toUpperCase()}`;

const getInvoiceDocumentData = ({ invoice, type, customerName, customerPhone, customerEmail, details = [] }) => ({
  invoiceNumber: getInvoiceNumber(invoice),
  invoiceDate: formatInvoiceDate(invoice.createdAt),
  type,
  customerName: customerName || 'Customer',
  customerPhone: customerPhone || 'Not provided',
  customerEmail: customerEmail || 'Not provided',
  paymentStatus: invoice.paymentStatus || 'Pending',
  details: details.filter(detail => detail.value),
  items: (invoice.items || []).map(item => ({
    description: item.productName || 'Auto part',
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.priceAtSale || 0)
  })),
  subtotal: Number(invoice.subtotal || 0),
  discount: Number(invoice.discount || 0),
  tax: Number(invoice.tax || 0),
  total: Number(invoice.total || 0)
});

const createCustomerInvoiceHtml = data => {
  const detailRows = data.details.map(detail => (
    `<tr><th>${escapeHtml(detail.label)}</th><td colspan="3">${escapeHtml(detail.value)}</td></tr>`
  )).join('');
  const itemRows = data.items.map((item, index) => (
    `<tr><td class="number">${index + 1}</td><td>${escapeHtml(item.description)}</td><td class="number">${item.quantity}</td><td class="amount">${formatMoney(item.unitPrice)}</td><td class="amount">${formatMoney(item.quantity * item.unitPrice)}</td></tr>`
  )).join('');
  const discountRow = data.discount > 0
    ? `<tr><td colspan="4">Discount</td><td class="amount">- ${formatMoney(data.discount)}</td></tr>`
    : '';
  const taxRow = data.tax > 0
    ? `<tr><td colspan="4">Tax</td><td class="amount">${formatMoney(data.tax)}</td></tr>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
    body{margin:0;padding:24px;background:#f3f5f8;color:#222;font-family:Arial,Helvetica,sans-serif}
    .invoice{max-width:720px;margin:0 auto;padding:32px 28px;background:#fff}
    .brand{text-align:center;margin-bottom:24px}.brand-mark{color:#0756b8;font-size:21px;font-weight:800;letter-spacing:.4px}.brand-mark span{color:#172033}
    h1{margin:12px 0 3px;font-size:24px}.subtitle{margin:0;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.7px}
    table{width:100%;border-collapse:collapse;font-size:12px}.details{margin:20px 0 28px}.details th,.details td{border:1px solid #d5d9df;padding:8px;text-align:left}.details th{width:15%;background:#f0f2f5;font-weight:700}
    h2{margin:0 0 8px 20px;font-size:14px}.items th{background:#222;color:#fff;padding:9px 8px;text-align:left}.items td{border:1px solid #c8cdd4;padding:9px 8px}.items tbody tr:nth-child(even){background:#f7f8fa}
    .number{text-align:center;width:36px}.amount{text-align:right;white-space:nowrap}.totals{width:58%;margin:18px 0 0 auto}.totals td{padding:7px 8px}.totals tr:last-child{border-top:1px solid #222;background:#f0f2f5;font-weight:700}.payment{margin-top:28px;padding:11px;border:1px solid #cbd2db;background:#f8f9fb;font-size:12px}.footer{margin:26px 20px 0;color:#60656d;font-size:11px}
    @media(max-width:520px){body{padding:8px}.invoice{padding:22px 14px}.details th,.details td,.items th,.items td{padding:6px 4px;font-size:10px}.totals{width:100%}}
  </style></head><body><main class="invoice">
    <header class="brand"><div class="brand-mark">WELGAMA <span>| AUTO PARTS</span></div><h1>Welgama Auto Parts</h1><p class="subtitle">${escapeHtml(data.type)} invoice</p></header>
    <table class="details"><tbody>
      <tr><th>Invoice No.</th><td>${escapeHtml(data.invoiceNumber)}</td><th>Date</th><td>${escapeHtml(data.invoiceDate)}</td></tr>
      <tr><th>Customer</th><td>${escapeHtml(data.customerName)}</td><th>Payment Status</th><td><strong>${escapeHtml(data.paymentStatus.toUpperCase())}</strong></td></tr>
      <tr><th>Phone</th><td>${escapeHtml(data.customerPhone)}</td><th>Email</th><td>${escapeHtml(data.customerEmail)}</td></tr>
      ${detailRows}
    </tbody></table>
    <h2>${escapeHtml(data.type === 'Repair' ? 'Repair Services' : 'Parts Purchased')}</h2>
    <table class="items"><thead><tr><th class="number">#</th><th>Description</th><th class="number">Qty</th><th class="amount">Unit Price</th><th class="amount">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
    <table class="totals"><tbody><tr><td colspan="4">Subtotal</td><td class="amount">${formatMoney(data.subtotal)}</td></tr>${discountRow}${taxRow}<tr><td colspan="4">Total</td><td class="amount">${formatMoney(data.total)}</td></tr></tbody></table>
    <div class="payment"><strong>Payment Status:</strong> ${escapeHtml(data.paymentStatus.toUpperCase())} &nbsp; | &nbsp; Thank you for your purchase!</div>
    <footer class="footer">Welgama Auto Parts - ${escapeHtml(data.type)} Invoice</footer>
  </main></body></html>`;
};

const createCustomerInvoicePdf = data => new Promise((resolve, reject) => {
  const document = new PDFDocument({ size: 'A4', margin: 14 });
  const chunks = [];
  document.on('data', chunk => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.on('error', reject);

  const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const left = document.page.margins.left;
  const logoPath = path.resolve(__dirname, '../public/welgama-logo.png');
  const columns = [pageWidth * 0.05, pageWidth * 0.37, pageWidth * 0.07, pageWidth * 0.25, pageWidth * 0.26];
  const tableHeaders = ['#', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT'];
  const labelColor = '#f0f2f5';
  const borderColor = '#d5dbe3';
  let y = 0;

  const drawCell = ({ x, top, width, height, text, fill = '#fff', color = '#222', bold = false, align = 'left', padding = 5, fontSize = 8.5 }) => {
    document.save().rect(x, top, width, height).fillAndStroke(fill, borderColor).restore();
    document.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
      .text(String(text ?? ''), x + padding, top + (height - fontSize) / 2 - 1, {
        width: Math.max(width - padding * 2, 1),
        height: Math.max(height - 3, 1),
        ellipsis: true,
        align
      });
  };

  const drawTableHeader = top => {
    let x = left;
    document.save().roundedRect(left, top, pageWidth, 18, 5).fill('#222').restore();
    tableHeaders.forEach((header, index) => {
      document.fillColor('#fff').font('Helvetica-Bold').fontSize(7.4)
        .text(header, x + 5, top + 6, {
          width: columns[index] - 10,
          align: index === 2 || index > 2 ? 'right' : 'left',
          lineBreak: false
        });
      x += columns[index];
    });
  };

  const drawInvoiceHeading = () => {
    const logoWidth = 88;
    const logoHeight = logoWidth * 724 / 2171;
    document.image(logoPath, left + (pageWidth - logoWidth) / 2, 18, { width: logoWidth, height: logoHeight });
    document.fillColor('#111827').font('Helvetica-Bold').fontSize(15)
      .text('Welgama Auto Parts', left, 52, { width: pageWidth, align: 'center' });
    document.fillColor('#5d687a').font('Helvetica').fontSize(8)
      .text(`${data.type.toUpperCase()} INVOICE`, left, 70, { width: pageWidth, align: 'center', characterSpacing: 0.7 });

    y = 83;
    const labelWidth = pageWidth * 0.15;
    const valueWidth = pageWidth * 0.23;
    const secondLabelWidth = pageWidth * 0.15;
    const secondValueWidth = pageWidth - labelWidth - valueWidth - secondLabelWidth;
    const detailsRows = [
      { left: ['Invoice No.', data.invoiceNumber], right: ['Date', data.invoiceDate] },
      { left: ['Customer', data.customerName], right: ['Payment Status', data.paymentStatus.toUpperCase(), data.paymentStatus === 'Paid' ? '#047857' : '#b45309'] },
      { left: ['Phone', data.customerPhone], right: ['Email', data.customerEmail] },
      ...data.details.map(detail => ({ full: [detail.label, detail.value] }))
    ];

    for (const row of detailsRows) {
      const height = 18;
      if (row.full) {
        const [label, value] = row.full;
        drawCell({ x: left, top: y, width: labelWidth, height, text: label.toUpperCase(), fill: labelColor, bold: true, fontSize: 7.3 });
        drawCell({ x: left + labelWidth, top: y, width: pageWidth - labelWidth, height, text: value, fontSize: 8.2 });
      } else {
        const [firstLabel, firstValue] = row.left;
        const [secondLabel, secondValue, secondColor = '#222'] = row.right;
        let x = left;
        drawCell({ x, top: y, width: labelWidth, height, text: firstLabel.toUpperCase(), fill: labelColor, bold: true, fontSize: 7.1 }); x += labelWidth;
        drawCell({ x, top: y, width: valueWidth, height, text: firstValue, fontSize: 8.1 }); x += valueWidth;
        drawCell({ x, top: y, width: secondLabelWidth, height, text: secondLabel.toUpperCase(), fill: labelColor, bold: true, fontSize: 7.1 }); x += secondLabelWidth;
        drawCell({ x, top: y, width: secondValueWidth, height, text: secondValue, color: secondColor, bold: secondLabel === 'Payment Status', fontSize: 8.1 });
      }
      y += height;
    }
    y += 12;
    document.fillColor('#222').font('Helvetica-Bold').fontSize(9.2)
      .text(data.type === 'Repair' ? 'Repair Services' : 'Parts Purchased', left, y);
    y += 15;
  };

  const startNextPage = () => {
    document.addPage();
    y = document.page.margins.top;
    drawTableHeader(y);
    y += 18;
  };

  drawInvoiceHeading();
  drawTableHeader(y);
  y += 18;

  data.items.forEach((item, index) => {
    const amount = formatMoney(item.quantity * item.unitPrice);
    const unitPrice = formatMoney(item.unitPrice);
    const descriptionHeight = document.heightOfString(item.description, {
      width: columns[1] - 12,
      font: 'Helvetica',
      fontSize: 8.3,
      lineGap: 1
    });
    const rowHeight = Math.max(20, descriptionHeight + 10);
    if (y + rowHeight > document.page.height - document.page.margins.bottom - 70) startNextPage();
    const rowFill = index % 2 ? '#f6f7f9' : '#fff';
    let x = left;
    const cells = [String(index + 1), item.description, String(item.quantity), unitPrice, amount];
    cells.forEach((text, cellIndex) => {
      drawCell({
        x,
        top: y,
        width: columns[cellIndex],
        height: rowHeight,
        text,
        fill: rowFill,
        align: cellIndex === 0 || cellIndex === 2 ? 'center' : cellIndex > 2 ? 'right' : 'left',
        fontSize: 8.3
      });
      x += columns[cellIndex];
    });
    y += rowHeight;
  });

  const totals = [
    ['Subtotal', formatMoney(data.subtotal)],
    ...(data.discount > 0 ? [['Discount', `- ${formatMoney(data.discount)}`]] : []),
    ...(data.tax > 0 ? [['Tax', formatMoney(data.tax)]] : []),
    ['Total', formatMoney(data.total)]
  ];
  const totalBlockHeight = totals.length * 19 + 14 + 34;
  if (y + totalBlockHeight > document.page.height - document.page.margins.bottom) {
    document.addPage();
    y = document.page.margins.top;
  }
  y += 12;
  const totalWidth = pageWidth * 0.48;
  const totalX = left + pageWidth - totalWidth;
  totals.forEach(([label, amount], index) => {
    const isTotal = index === totals.length - 1;
    if (isTotal) document.rect(totalX, y, totalWidth, 21).fillAndStroke('#eef1f5', borderColor);
    document.fillColor('#222').font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
      .text(label, totalX + 5, y + 6, { width: totalWidth * 0.48 });
    document.font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
      .text(amount, totalX + totalWidth * 0.48, y + 6, { width: totalWidth * 0.49 - 5, align: 'right' });
    y += isTotal ? 21 : 19;
  });

  y += 18;
  document.rect(left, y, pageWidth, 25).fillAndStroke('#f8f9fb', '#cbd2db');
  document.fillColor('#222').font('Helvetica-Bold').fontSize(8)
    .text('Payment Status:', left + 6, y + 8);
  document.font('Helvetica').text(data.paymentStatus, left + 76, y + 8);
  document.text('Thank you for your purchase!', left + 132, y + 8);
  y += 44;
  document.fillColor('#60656d').fontSize(7.3)
    .text(`Welgama Auto Parts | ${data.type} Invoice`, left + 18, y);
  document.end();
});

module.exports = {
  createCustomerInvoiceHtml,
  createCustomerInvoicePdf,
  escapeHtml,
  formatMoney,
  getInvoiceDocumentData,
  getInvoiceNumber
};
