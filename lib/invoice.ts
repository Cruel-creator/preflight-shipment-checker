import { dmy, money, num } from '@/lib/format';
import type { Booking, Confirmation } from '@/lib/types';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const todo = (label: string) => `<span class="todo">To complete: ${esc(label)}</span>`;

export function invoiceNumber(b: Booking, today: string) {
  return `INV-${b.bookingId}-${today.replace(/-/g, '')}`;
}

/** Self-contained printable HTML for a draft commercial invoice. Guidance only — not part of the scored rulebook. */
export function buildInvoiceHtml(b: Booking, c: Confirmation, today: string): string {
  const goods = b.items.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
  const net = b.items.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitWeightKg ?? 0), 0);
  const freight = c.totalCost;
  const rows = b.items
    .map(
      (i) => `<tr><td>${esc(i.sku)}</td><td>${esc(i.description)}</td><td>${i.hsCode ? esc(i.hsCode) : todo('HS code')}</td><td>${i.countryOfOrigin ? esc(i.countryOfOrigin) : todo('country of origin')}</td><td class="r">${num(i.quantity ?? 0)}</td><td class="r">${money(i.unitPrice ?? 0)}</td><td class="r">${money((i.quantity ?? 0) * (i.unitPrice ?? 0))}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(invoiceNumber(b, today))}</title>
<style>
body{font:13px/1.45 system-ui,Arial,sans-serif;color:#14181f;margin:24px;max-width:900px}
h1{font-size:20px;margin:0 0 4px} .draft{color:#8a5300;font-weight:600}
table{border-collapse:collapse;width:100%;margin:10px 0} th,td{border:1px solid #ccd2da;padding:5px 7px;text-align:left;vertical-align:top} th{background:#f0f2f5}
.r{text-align:right} .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.box{border:1px solid #ccd2da;padding:8px 10px;border-radius:6px} .box h3{margin:0 0 4px;font-size:12px;text-transform:uppercase;color:#5b6573}
.todo{background:#fff3d6;color:#8a5300;border:1px dashed #d9a441;padding:0 4px;border-radius:3px;font-size:12px}
@media print{.todo{border:1px dashed #999;background:#fff3d6;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>Commercial invoice</h1>
<div class="draft">DRAFT — highlighted fields must be completed before use</div>
<p><b>Invoice no:</b> ${esc(invoiceNumber(b, today))} &nbsp; <b>Date of issue:</b> ${esc(dmy(today))} &nbsp; <b>Related paperwork (proforma / PO / contract) no. and date:</b> ${todo('reference and date')}</p>
<div class="grid">
<div class="box"><h3>Seller / exporter</h3>${esc(b.sellerName) || todo('seller name')}<br>${todo('full address')}<br>${todo('contact name, phone, email')}<br>${todo('EORI / VAT number')}</div>
<div class="box"><h3>Buyer</h3>${todo('buyer name')}<br>${todo('full address')}<br>${todo('contact details')}<br><br><b>Consignee (if different):</b> ${todo('name and address')}</div>
</div>
<div class="grid" style="margin-top:12px">
<div class="box"><h3>Shipment</h3>Route: ${esc(c.route)}<br>Carrier: ${esc(c.carrierLine ?? '—')}<br>Collection date: ${esc(b.readyDate ? dmy(b.readyDate) : '—')}<br>Packages: ${num(b.cartons ?? 0)} cartons on ${num(b.pallets ?? 0)} pallets<br>Carton marks: ${b.cartons ? `Cartons 1–${num(b.cartons)} of ${num(b.cartons)}` : todo('carton marks')}</div>
<div class="box"><h3>Terms</h3>Currency: GBP<br>Incoterms: ${todo('e.g. DAP / DDP / EXW')}<br>Method of payment: ${todo('payment terms')}<br>Discounts: ${todo('discounts, if any')}<br>Insurance: ${todo('insurance cost, if any')}<br>Certification needed: ${todo('e.g. origin certificate, if required')}</div>
</div>
<table><thead><tr><th>SKU</th><th>Description</th><th>HS code</th><th>Origin</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Line total</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td colspan="6" class="r"><b>Total goods value</b></td><td class="r"><b>${money(goods)}</b></td></tr>
<tr><td colspan="6" class="r">Freight (${esc(c.carrierLine ?? 'carrier TBC')}, additional charge)</td><td class="r">${freight != null ? money(freight) : todo('freight cost')}</td></tr>
<tr><td colspan="6" class="r">Other charges</td><td class="r">${todo('other charges')}</td></tr></tfoot></table>
<p><b>Net weight:</b> ${num(Math.round(net * 10) / 10, 1)} kg (goods) &nbsp; <b>Gross weight:</b> ${b.grossWeightKg != null ? num(b.grossWeightKg, 1) + ' kg' : todo('gross weight')}</p>
<p style="color:#5b6573;font-size:12px">Draft prepared by PreFlight from the booking data. Based on the UK government guide to export (commercial) invoices. This is guidance, not legal or customs advice.</p>
</body></html>`;
}
