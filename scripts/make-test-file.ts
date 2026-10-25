/**
 * Generates public/sample-test-data.xlsx in the exact template structure
 * (title row 1, headers row 2, data from row 3) with one clean booking and
 * one planted violation per rule, plus tricky edge cases.
 * Dates are relative to today (Europe/London) so R-10 stays valid on any day.
 */
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { addDays, londonToday } from '../lib/dates';

const today = londonToday();
const dmy = (offset: number) => addDays(today, offset).split('-').reverse().join('-');

type It = [sku: string, desc: string, hs: number | string | null, qty: number, price: number, upc: number, cartons: number, unitW: number, origin: string | null];
interface Over { cartons?: number; value?: number; weight?: number; appt?: 'Yes' | 'No' }

const bookingRows: (string | number)[][] = [];
const itemRows: (string | number | null)[][] = [];

function add(
  id: string, seller: string, oCity: string, dCity: string, dCountry: string, type: string,
  dateOffset: number, prio: string, pallets: number, items: It[], o: Over = {},
) {
  const sumCartons = items.reduce((s, i) => s + i[6], 0);
  const value = items.reduce((s, i) => s + i[3] * i[4], 0);
  const net = items.reduce((s, i) => s + i[3] * i[7], 0);
  bookingRows.push([
    id, seller, oCity, 'United Kingdom', dCity, dCountry, type, dmy(dateOffset), prio, pallets,
    o.cartons ?? sumCartons, o.value ?? value, 'GBP', o.weight ?? Math.ceil(net * 1.05 + 25 * pallets), o.appt ?? 'Yes',
  ]);
  for (const i of items) itemRows.push([id, i[0], i[1], i[2], i[3], i[4], i[5], i[6], i[7], i[8]]);
}

const mug: It = ['MUG-01', 'Ceramic coffee mug, 350 ml', 691200, 1080, 5, 12, 90, 0.5, 'United Kingdom'];

// BK-001 — the template example: must pass everything
add('BK-001', 'Northfield Goods', 'Manchester', 'Frankfurt', 'Germany', 'Warehouse', 10, 'Cheapest', 3, [mug], { weight: 620 });
// R-01 — missing HS code
add('BK-002', 'Harbour Home', 'Birmingham', 'Paris', 'France', 'Warehouse', 8, 'Balanced', 2,
  [['TEA-01', 'Loose leaf black tea, 250 g tin', null, 600, 4, 24, 25, 0.35, 'India']]);
// R-01 — 5-digit HS code (Excel dropped the leading zero of 090111)
add('BK-003', 'Brightside Coffee', 'London', 'Amsterdam', 'Netherlands', 'Warehouse', 6, 'Most reliable', 2,
  [['COF-01', 'Green coffee beans, 5 kg sack', 90111, 200, 22, 5, 40, 5, 'Vietnam']]);
// R-02 — declared value doesn't match items
add('BK-004', 'Lakeside Textiles', 'Leeds', 'Hamburg', 'Germany', 'Business address', 9, 'Cheapest', 2,
  [['TOW-01', 'Cotton bath towel, 70x140 cm', 630260, 800, 9.5, 20, 40, 0.6, 'Turkey']], { value: 6100 });
// R-03 — units per carton × cartons ≠ quantity (booking total follows the item, so no R-04)
add('BK-005', 'Pennine Pottery', 'Manchester', 'Berlin', 'Germany', 'Warehouse', 7, 'Fastest', 2,
  [['PLT-01', 'Stoneware dinner plate, 27 cm', 691110, 600, 6, 10, 55, 0.7, 'United Kingdom']]);
// R-03 on one item causes R-04 on the booking (one root cause)
add('BK-006', 'Metro Gifts', 'London', 'Lyon', 'France', 'Warehouse', 12, 'Balanced', 3, [
  ['CAN-01', 'Scented soy candle in glass jar', 340600, 480, 7, 12, 40, 0.45, 'United Kingdom'],
  ['NOT-01', 'Hardback notebook, A5', 482020, 600, 3.5, 20, 25, 0.3, 'China'],
], { cartons: 70 });
// R-05 — 800 kg per pallet: no carrier can take it (Red)
add('BK-007', 'Ironbridge Hardware', 'Birmingham', 'Frankfurt', 'Germany', 'Warehouse', 11, 'Cheapest', 2,
  [['BKE-01', 'Steel bookend pair', 732399, 400, 12, 10, 40, 3.5, 'India']], { weight: 1600 });
// 450 kg per pallet + Fastest: Carrier C excluded by weight, Carrier B chosen (Info, not Red)
add('BK-008', 'Fieldmarket Bags', 'Leeds', 'Rotterdam', 'Netherlands', 'Warehouse', 9, 'Fastest', 2,
  [['TOT-01', 'Heavy canvas tote bag', 630590, 1200, 6, 50, 24, 0.6, 'India']], { weight: 900 });
// R-06 — lithium battery
add('BK-009', 'VoltEdge Gadgets', 'London', 'Berlin', 'Germany', 'Business address', 8, 'Fastest', 2, [
  ['PWR-01', 'Lithium power bank 10,000 mAh', 850760, 300, 14, 10, 30, 0.25, 'China'],
]);
// Lithium-free: keyword appears but is negated — must NOT be flagged
add('BK-010', 'Pure Skin Co', 'Manchester', 'Paris', 'France', 'Warehouse', 9, 'Most reliable', 2,
  [['CLN-01', 'Lithium-free facial cleanser, 200 ml', 330499, 1000, 4, 20, 50, 0.3, 'United Kingdom']]);
// R-07 — gross weight less than the goods alone
add('BK-011', 'Anvil & Co', 'Birmingham', 'Hamburg', 'Germany', 'Business address', 10, 'Balanced', 2,
  [['PAN-01', 'Cast iron frying pan, 28 cm', 732393, 200, 18, 10, 20, 2.4, 'United Kingdom']], { weight: 400 });
// R-08 — warehouse delivery with no appointment
add('BK-012', 'Greenfield Plants', 'Leeds', 'Amsterdam', 'Netherlands', 'Warehouse', 7, 'Cheapest', 1,
  [['POT-01', 'Terracotta plant pot, 15 cm', 691490, 240, 2.5, 12, 20, 1.1, 'Turkey']], { appt: 'No' });
// R-09 — blank country of origin
add('BK-013', 'Oakhouse Living', 'London', 'Berlin', 'Germany', 'Warehouse', 8, 'Balanced', 1,
  [['SPN-01', 'Wooden serving spoon set', 442199, 500, 3, 25, 20, 0.2, null]]);
// R-10 — ready date in the past
add('BK-014', 'Quickship Stationery', 'Manchester', 'Paris', 'France', 'Business address', -3, 'Cheapest', 1,
  [['PEN-01', 'Ballpoint pens, box of 50', 960810, 400, 8, 40, 10, 0.4, 'China']]);
// DATA — Lyon is in France, not Germany
add('BK-015', 'Rhine Imports', 'London', 'Lyon', 'Germany', 'Warehouse', 9, 'Cheapest', 1,
  [['SCF-01', 'Wool scarf', 621410, 300, 12, 15, 20, 0.3, 'United Kingdom']]);

const wb = XLSX.utils.book_new();
const bHead = ['Booking ID', 'Seller name', 'Origin city', 'Origin country', 'Destination city', 'Destination country', 'Destination type', 'Ready to ship date', 'Seller priority', 'Pallets', 'Cartons', 'Total declared value', 'Currency', 'Total gross weight (kg)', 'Delivery appointment booked'];
const iHead = ['Booking ID', 'SKU', 'Description', 'HS code', 'Quantity (units)', 'Unit price', 'Units per carton', 'Cartons', 'Unit weight (kg)', 'Country of origin'];
const bSheet = XLSX.utils.aoa_to_sheet([['Bookings — one row per record. Row 3 is an example (grey); enter data from row 4.'], bHead, ...bookingRows]);
const iSheet = XLSX.utils.aoa_to_sheet([['Items — one row per record. Row 3 is an example (grey); enter data from row 4.'], iHead, ...itemRows]);
bSheet['!cols'] = bHead.map((h) => ({ wch: Math.max(14, h.length + 2) }));
iSheet['!cols'] = iHead.map((h, i) => ({ wch: i === 2 ? 36 : Math.max(12, h.length + 2) }));
XLSX.utils.book_append_sheet(wb, bSheet, 'Bookings');
XLSX.utils.book_append_sheet(wb, iSheet, 'Items');

const out = path.join(__dirname, '..', 'public', 'sample-test-data.xlsx');
fs.mkdirSync(path.dirname(out), { recursive: true });
XLSX.writeFile(wb, out);
console.log(`Wrote ${out}: ${bookingRows.length} bookings, ${itemRows.length} items (dates relative to ${today})`);
