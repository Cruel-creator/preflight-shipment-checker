import * as XLSX from 'xlsx';
import {
  DESTINATIONS, DESTINATION_TYPES, ITEM_ORIGIN_COUNTRIES, ORIGIN_CITIES, PRIORITIES,
} from '@/lib/data/reference';
import { isValidIso } from '@/lib/dates';
import type { Booking, Issue, Item, Priority } from '@/lib/types';

export const MAX_ROWS = 500;

export interface ParseResult {
  bookings: Booking[];
  /** Problems that belong to no single booking (e.g. items for an unknown Booking ID). */
  warnings: Issue[];
}

type Cell = string | number | boolean | Date | null | undefined;

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const str = (v: Cell): string | null => {
  if (v == null) return null;
  const s = (v instanceof Date ? v.toISOString() : String(v)).trim();
  return s === '' ? null : s;
};

const dataIssue = (id: string, severity: Issue['severity'], title: string, whatsWrong: string, howToFix: string[], itemSku?: string): Issue => ({
  ruleId: id, severity, itemSku, title, whatsWrong,
  whyItMatters: 'This is an input problem, not a rulebook rule: the app cannot check this part of the booking reliably until it is fixed.',
  howToFix,
});

/** Case-insensitive match to a canonical allowed value; otherwise return the trimmed original. */
function canon(v: string | null, allowed: readonly string[]): string | null {
  if (!v) return null;
  return allowed.find((a) => a.toLowerCase() === v.toLowerCase()) ?? v;
}

function toNumber(v: Cell, label: string, where: string, issues: Issue[], sku?: string): number | null {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return null;
  let n: number;
  if (typeof v === 'number') n = v;
  else {
    const cleaned = String(v).trim().replace(/[£,\s]/g, '');
    n = cleaned === '' || !/^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(cleaned) ? NaN : Number(cleaned);
  }
  if (!Number.isFinite(n)) {
    issues.push(dataIssue('DATA-06', 'Red', `${label} is not a number`, `${where}: "${String(v)}" in ${label} is not a valid number.`, [`Enter ${label} as a plain number.`], sku));
    return null;
  }
  if (n < 0) {
    issues.push(dataIssue('DATA-06', 'Red', `${label} is negative`, `${where}: ${label} is ${n}, which cannot be negative.`, [`Enter a positive value for ${label}.`], sku));
    return null;
  }
  return n;
}

/** Strict DD-MM-YYYY (also / and .), an Excel serial, a JS Date, or ISO yyyy-mm-dd. */
export function parseDate(v: Cell): { iso: string | null; invalid: boolean } {
  if (v == null || (typeof v === 'string' && !v.trim())) return { iso: null, invalid: false };
  if (v instanceof Date && !isNaN(+v)) {
    // SheetJS-created dates are local-midnight; use local parts so the calendar day survives.
    const iso = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    return { iso, invalid: false };
  }
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    if (!p || v < 1) return { iso: null, invalid: true };
    const iso = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
    return { iso, invalid: !isValidIso(iso) };
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // day first, always
    return isValidIso(iso) ? { iso, invalid: false } : { iso: null, invalid: true };
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    return isValidIso(iso) ? { iso, invalid: false } : { iso: null, invalid: true };
  }
  return { iso: null, invalid: true };
}

/** HS codes are identifiers: numbers become integer strings, text is kept as typed. */
export function parseHs(v: Cell): string | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.trunc(v)) : null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parseYesNo(v: Cell): boolean | null | 'invalid' {
  const s = str(v)?.toLowerCase();
  if (!s) return null;
  if (['yes', 'y', 'true'].includes(s)) return true;
  if (['no', 'n', 'false'].includes(s)) return false;
  return 'invalid';
}

interface Table { header: string[]; rows: Cell[][] }

function readTable(ws: XLSX.WorkSheet): Table | null {
  const all = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
  const hi = all.findIndex((r) => r.some((c) => norm(c) === 'booking id'));
  if (hi < 0) return null;
  return {
    header: all[hi].map(norm),
    rows: all.slice(hi + 1).filter((r) => r.some((c) => c != null && String(c).trim() !== '')),
  };
}

function col(t: Table, ...names: string[]): number {
  for (const n of names) {
    const i = t.header.indexOf(norm(n));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseWorkbook(data: ArrayBuffer | Uint8Array | Buffer): ParseResult {
  const wb = XLSX.read(data, { type: 'array', cellDates: false });
  const find = (name: string) => wb.SheetNames.find((n) => norm(n) === name);
  const bName = find('bookings') ?? wb.SheetNames[0];
  const iName = find('items') ?? wb.SheetNames[1];
  const bt = bName ? readTable(wb.Sheets[bName]) : null;
  const it = iName ? readTable(wb.Sheets[iName]) : null;
  if (!bt) throw new Error('Could not find a "Bookings" sheet with a "Booking ID" column.');
  if (!it) throw new Error('Could not find an "Items" sheet with a "Booking ID" column.');
  if (bt.rows.length + it.rows.length > MAX_ROWS * 2) throw new Error(`Too many rows. The limit is ${MAX_ROWS} bookings.`);
  if (bt.rows.length > MAX_ROWS) throw new Error(`Too many bookings (${bt.rows.length}). The limit is ${MAX_ROWS}.`);

  const C = {
    id: col(bt, 'Booking ID'), seller: col(bt, 'Seller name'), oCity: col(bt, 'Origin city'), oCountry: col(bt, 'Origin country'),
    dCity: col(bt, 'Destination city'), dCountry: col(bt, 'Destination country'), dType: col(bt, 'Destination type'),
    ready: col(bt, 'Ready to ship date', 'Ready date'), prio: col(bt, 'Seller priority', 'Priority'), pallets: col(bt, 'Pallets'),
    cartons: col(bt, 'Cartons'), value: col(bt, 'Total declared value', 'Declared value'), currency: col(bt, 'Currency'),
    weight: col(bt, 'Total gross weight (kg)', 'Gross weight (kg)'), appt: col(bt, 'Delivery appointment booked', 'Appointment booked'),
  };
  const I = {
    id: col(it, 'Booking ID'), sku: col(it, 'SKU'), desc: col(it, 'Description'), hs: col(it, 'HS code', 'HS'),
    qty: col(it, 'Quantity (units)', 'Quantity'), price: col(it, 'Unit price'), upc: col(it, 'Units per carton'),
    cartons: col(it, 'Cartons'), weight: col(it, 'Unit weight (kg)', 'Unit weight'), origin: col(it, 'Country of origin'),
  };
  const get = (r: Cell[], i: number): Cell => (i >= 0 ? r[i] : null);
  const warnings: Issue[] = [];

  // The template ships with a grey example row (BK-001, Northfield Goods). If the uploaded data also
  // uses BK-001, keeping the example would merge two bookings under one ID, so leave the example out.
  const sig = (r: Cell[], text: number[], nums: number[]) =>
    [...text.map((i) => norm(get(r, i))), ...nums.map((i) => String(Number(get(r, i))))].join('|');
  const exampleBooking = (r: Cell[]) =>
    sig(r, [C.id, C.seller, C.oCity, C.dCity], [C.pallets, C.cartons, C.value, C.weight]) === 'bk-001|northfield goods|manchester|frankfurt|3|90|5400|620';
  const exampleItem = (r: Cell[]) =>
    sig(r, [I.id, I.sku], [I.qty, I.price, I.upc, I.cartons]) === 'bk-001|mug-01|1080|5|12|90';
  if (bt.rows.length > 1 && exampleBooking(bt.rows[0]) && bt.rows.slice(1).some((r) => norm(get(r, C.id)) === 'bk-001')) {
    bt.rows.shift();
    const ei = it.rows.findIndex(exampleItem);
    if (ei >= 0) it.rows.splice(ei, 1);
    warnings.push(dataIssue('DATA-10', 'Info', 'Template example row skipped',
      'The first row is the template\'s grey example (BK-001, Northfield Goods) and another booking also uses BK-001, so the example row and its MUG-01 item were left out to keep the two bookings apart.',
      ['Delete the grey example row before uploading.']));
  }

  const bookings: Booking[] = [];
  const byId = new Map<string, Booking>();
  const seen = new Map<string, number>();

  for (const r of bt.rows) {
    const id = str(get(r, C.id)) ?? '(no ID)';
    const issues: Issue[] = [];
    const where = `Booking ${id}`;
    const missing = (label: string, v: unknown) => {
      if (v == null) issues.push(dataIssue('DATA-09', 'Red', `${label} is missing`, `${where}: ${label} is blank but is required.`, [`Fill in ${label}.`]));
    };
    const d = parseDate(get(r, C.ready));
    if (d.invalid) {
      issues.push(dataIssue('DATA-08', 'Red', 'Ready date not understood', `${where}: "${String(get(r, C.ready))}" is not a valid date. Use DD-MM-YYYY, e.g. 05-11-2026 (day first).`, ['Enter the date as DD-MM-YYYY.']));
    }
    const apptRaw = parseYesNo(get(r, C.appt));
    if (apptRaw === 'invalid') issues.push(dataIssue('DATA-02', 'Red', 'Appointment value not understood', `${where}: "${String(get(r, C.appt))}" — use Yes or No.`, ['Use Yes or No.']));

    const dCountry = canon(str(get(r, C.dCountry)), Object.keys(DESTINATIONS));
    const allDestCities = Object.values(DESTINATIONS).flat();
    const b: Booking = {
      bookingId: id,
      sellerName: str(get(r, C.seller)),
      originCity: canon(str(get(r, C.oCity)), ORIGIN_CITIES),
      originCountry: 'United Kingdom',
      destinationCity: canon(str(get(r, C.dCity)), dCountry && DESTINATIONS[dCountry] ? [...DESTINATIONS[dCountry], ...allDestCities] : allDestCities),
      destinationCountry: dCountry,
      destinationType: canon(str(get(r, C.dType)), DESTINATION_TYPES) as Booking['destinationType'],
      readyDate: d.iso,
      priority: canon(str(get(r, C.prio)), PRIORITIES) as Priority | null,
      pallets: toNumber(get(r, C.pallets), 'Pallets', where, issues),
      cartons: toNumber(get(r, C.cartons), 'Cartons', where, issues),
      declaredValue: toNumber(get(r, C.value), 'Total declared value', where, issues),
      currency: 'GBP',
      grossWeightKg: toNumber(get(r, C.weight), 'Total gross weight (kg)', where, issues),
      appointmentBooked: apptRaw === 'invalid' ? null : apptRaw,
      items: [],
      parseIssues: issues,
    };
    const oc = str(get(r, C.oCountry));
    if (oc && norm(oc) !== 'united kingdom') issues.push(dataIssue('DATA-02', 'Red', 'Unsupported origin country', `${where}: origin country "${oc}" is not supported — shipments must start in the United Kingdom.`, ['Set origin country to United Kingdom.']));
    const cur = str(get(r, C.currency));
    if (cur && cur.toUpperCase() !== 'GBP') issues.push(dataIssue('DATA-02', 'Red', 'Unsupported currency', `${where}: currency "${cur}" is not supported — GBP only.`, ['Convert values to GBP and set currency to GBP.']));

    if (id === '(no ID)') issues.push(dataIssue('DATA-09', 'Red', 'Booking ID is missing', 'A booking row has no Booking ID, so items cannot be matched to it.', ['Give every booking a unique Booking ID.']));
    missing('Seller name', b.sellerName); missing('Origin city', b.originCity); missing('Destination city', b.destinationCity);
    missing('Destination country', b.destinationCountry); missing('Destination type', b.destinationType);
    if (!d.invalid) missing('Ready to ship date', b.readyDate);
    missing('Seller priority', b.priority);
    if (get(r, C.pallets) == null || String(get(r, C.pallets)).trim() === '') missing('Pallets', null);
    if (get(r, C.cartons) == null || String(get(r, C.cartons)).trim() === '') missing('Cartons', null);
    if (get(r, C.value) == null || String(get(r, C.value)).trim() === '') missing('Total declared value', null);
    if (get(r, C.weight) == null || String(get(r, C.weight)).trim() === '') missing('Total gross weight (kg)', null);
    if (apptRaw === null) missing('Delivery appointment booked', null);

    const prev = seen.get(id) ?? 0;
    seen.set(id, prev + 1);
    if (prev > 0) {
      issues.push(dataIssue('DATA-05', 'Red', 'Duplicate Booking ID', `${id} appears ${prev + 1} times on the Bookings sheet. Items are matched to the first one only.`, ['Give each booking a unique Booking ID.']));
      const first = byId.get(id)!;
      if (!first.parseIssues?.some((i) => i.ruleId === 'DATA-05')) first.parseIssues!.push(dataIssue('DATA-05', 'Red', 'Duplicate Booking ID', `${id} appears more than once on the Bookings sheet.`, ['Give each booking a unique Booking ID.']));
    } else byId.set(id, b);
    bookings.push(b);
  }

  for (const r of it.rows) {
    const id = str(get(r, I.id));
    const sku = str(get(r, I.sku)) ?? '(no SKU)';
    const target = id ? byId.get(id) : undefined;
    if (!target) {
      warnings.push(dataIssue('DATA-04', 'Red', 'Item has no matching booking', `Item ${sku} refers to Booking ID "${id ?? '(blank)'}", which is not on the Bookings sheet.`, ['Fix the Booking ID on the item, or add the booking.'], sku));
      continue;
    }
    const where = `Booking ${target.bookingId}, item ${sku}`;
    const issues = target.parseIssues!;
    const miss = (label: string) => issues.push(dataIssue('DATA-09', 'Red', `${label} is missing`, `${where}: ${label} is blank but is required.`, [`Fill in ${label}.`], sku));
    const num = (i: number, label: string) => {
      const v = get(r, i);
      if (v == null || String(v).trim() === '') { miss(label); return null; }
      return toNumber(v, label, where, issues, sku);
    };
    const origin = str(get(r, I.origin));
    const item: Item = {
      sku,
      description: str(get(r, I.desc)) ?? '',
      hsCode: parseHs(get(r, I.hs)),
      quantity: num(I.qty, 'Quantity'),
      unitPrice: num(I.price, 'Unit price'),
      unitsPerCarton: num(I.upc, 'Units per carton'),
      cartons: num(I.cartons, 'Cartons'),
      unitWeightKg: num(I.weight, 'Unit weight (kg)'),
      countryOfOrigin: origin ? canon(origin, ITEM_ORIGIN_COUNTRIES) : null,
    };
    if (sku === '(no SKU)') issues.push(dataIssue('DATA-09', 'Red', 'SKU is missing', `${where}: SKU is blank.`, ['Give every item a SKU.']));
    target.items.push(item);
  }
  return { bookings, warnings };
}
