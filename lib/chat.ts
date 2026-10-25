import { DESTINATIONS, DESTINATION_TYPES, ITEM_ORIGIN_COUNTRIES, ORIGIN_CITIES, PRIORITIES } from '@/lib/data/reference';
import { isValidIso } from '@/lib/dates';
import { money, num } from '@/lib/format';
import type { Booking, Item, Priority } from '@/lib/types';
import type { BookingResult } from '@/lib/analyze';

export function emptyBooking(): Booking {
  return {
    bookingId: 'CHAT-1', sellerName: null, originCity: null, originCountry: 'United Kingdom',
    destinationCity: null, destinationCountry: null, destinationType: null, readyDate: null, priority: null,
    pallets: null, cartons: null, declaredValue: null, currency: 'GBP', grossWeightKg: null,
    appointmentBooked: null, items: [], derived: {},
  };
}

/** What the model extracts from one seller message. Only things the seller actually said. */
export interface ItemOp {
  op: 'add' | 'update' | 'remove';
  sku?: string;
  description?: string;
  hsCode?: string;
  quantity?: number;
  unitPrice?: number;
  unitsPerCarton?: number;
  cartons?: number;
  unitWeightKg?: number;
  countryOfOrigin?: string;
}
export interface BookingUpdate {
  sellerName?: string;
  originCity?: string;
  destinationCity?: string;
  destinationCountry?: string;
  destinationType?: string;
  readyDate?: string;
  priority?: string;
  pallets?: number;
  cartons?: number;
  declaredValue?: number;
  grossWeightKg?: number;
  appointmentBooked?: boolean;
  confirmDerived?: boolean;
  itemOps?: ItemOp[];
}

export interface Change { field: string; label: string; from: string | null; to: string | null }
export interface Rejected { field: string; value: string; options: string[] }

const canon = (v: string, list: readonly string[]) => list.find((x) => x.toLowerCase() === v.trim().toLowerCase()) ?? null;
const isPos = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const fmt = (v: unknown): string | null => (v == null ? null : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));

const LABELS: Record<string, string> = {
  sellerName: 'Seller', originCity: 'Origin city', destinationCity: 'Destination city', destinationCountry: 'Destination country',
  destinationType: 'Destination type', readyDate: 'Ready date', priority: 'Priority', pallets: 'Pallets', cartons: 'Cartons',
  declaredValue: 'Declared value', grossWeightKg: 'Gross weight (kg)', appointmentBooked: 'Delivery appointment booked',
};

function cityCountry(city: string): string | null {
  return Object.entries(DESTINATIONS).find(([, cs]) => cs.some((c) => c.toLowerCase() === city.toLowerCase()))?.[0] ?? null;
}

const itemLabel: Record<string, string> = {
  description: 'description', hsCode: 'HS code', quantity: 'quantity', unitPrice: 'unit price', unitsPerCarton: 'units per carton',
  cartons: 'cartons', unitWeightKg: 'unit weight (kg)', countryOfOrigin: 'country of origin',
};

function findItem(items: Item[], op: ItemOp): Item | undefined {
  if (op.sku) {
    const bySku = items.find((i) => i.sku.toLowerCase() === op.sku!.toLowerCase());
    if (bySku) return bySku;
  }
  if (op.description) {
    const d = op.description.toLowerCase();
    const byDesc = items.find((i) => i.description.toLowerCase().includes(d) || d.includes(i.description.toLowerCase()));
    if (byDesc) return byDesc;
  }
  if (!op.sku && items.length === 1) return items[0];
  return undefined;
}

export function recomputeDerived(b: Booking): void {
  b.derived ??= {};
  const its = b.items;
  if ((b.declaredValue == null || b.derived.declaredValue) && its.length && its.every((i) => isPos(i.quantity) && isPos(i.unitPrice))) {
    b.declaredValue = its.reduce((s, i) => s + i.quantity! * i.unitPrice!, 0);
    b.derived.declaredValue = true;
  }
  if ((b.cartons == null || b.derived.cartons) && its.length && its.every((i) => isPos(i.cartons))) {
    b.cartons = its.reduce((s, i) => s + i.cartons!, 0);
    b.derived.cartons = true;
  }
}

/** Merge an extraction into the draft. Pure: returns a new draft, a change log and rejected values. */
export function applyUpdate(prev: Booking, u: BookingUpdate): { draft: Booking; changes: Change[]; rejected: Rejected[] } {
  const draft: Booking = structuredClone(prev);
  draft.derived ??= {};
  const changes: Change[] = [];
  const rejected: Rejected[] = [];
  const set = <K extends keyof Booking>(k: K, v: Booking[K]) => {
    if (draft[k] !== v) {
      changes.push({ field: k, label: LABELS[k] ?? k, from: fmt(draft[k]), to: fmt(v) });
      draft[k] = v;
    }
  };
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  if (str(u.sellerName)) set('sellerName', str(u.sellerName)!);
  if (str(u.originCity)) {
    const c = canon(str(u.originCity)!, ORIGIN_CITIES);
    if (c) set('originCity', c); else rejected.push({ field: 'originCity', value: u.originCity!, options: ORIGIN_CITIES });
  }
  if (str(u.destinationCountry)) {
    const c = canon(str(u.destinationCountry)!, Object.keys(DESTINATIONS));
    if (c) set('destinationCountry', c); else rejected.push({ field: 'destinationCountry', value: u.destinationCountry!, options: Object.keys(DESTINATIONS) });
  }
  if (str(u.destinationCity)) {
    const raw = str(u.destinationCity)!;
    const country = cityCountry(raw);
    const known = country ? DESTINATIONS[country].find((c) => c.toLowerCase() === raw.toLowerCase())! : null;
    if (known) {
      set('destinationCity', known);
      if (!u.destinationCountry && country !== draft.destinationCountry) set('destinationCountry', country!);
    } else {
      rejected.push({ field: 'destinationCity', value: raw, options: draft.destinationCountry && DESTINATIONS[draft.destinationCountry] ? DESTINATIONS[draft.destinationCountry] : Object.entries(DESTINATIONS).flatMap(([c, cs]) => cs.map((x) => `${x} (${c})`)) });
    }
  }
  if (str(u.destinationType)) {
    const c = canon(str(u.destinationType)!, DESTINATION_TYPES);
    if (c) set('destinationType', c as Booking['destinationType']); else rejected.push({ field: 'destinationType', value: u.destinationType!, options: [...DESTINATION_TYPES] });
  }
  if (str(u.priority)) {
    const c = canon(str(u.priority)!, PRIORITIES);
    if (c) set('priority', c as Priority); else rejected.push({ field: 'priority', value: u.priority!, options: [...PRIORITIES] });
  }
  if (str(u.readyDate)) {
    if (isValidIso(str(u.readyDate)!)) set('readyDate', str(u.readyDate)!); else rejected.push({ field: 'readyDate', value: u.readyDate!, options: ['a valid date'] });
  }
  for (const k of ['pallets', 'cartons', 'declaredValue', 'grossWeightKg'] as const) {
    const v = u[k];
    if (v == null) continue;
    if (isPos(v)) {
      set(k, v);
      if (k === 'cartons' || k === 'declaredValue') draft.derived[k] = false; // stated by the seller
    } else rejected.push({ field: k, value: String(v), options: ['a positive number'] });
  }
  if (typeof u.appointmentBooked === 'boolean') set('appointmentBooked', u.appointmentBooked);
  if (u.confirmDerived) draft.derived = { cartons: false, declaredValue: false };

  for (const op of u.itemOps ?? []) {
    if (op.op === 'add') {
      const sku = op.sku?.trim() || `ITEM-${draft.items.length + 1}`;
      const existing = draft.items.find((i) => i.sku.toLowerCase() === sku.toLowerCase());
      if (existing) { applyItemFields(existing, op, changes); continue; }
      const item: Item = { sku, description: op.description?.trim() || '', hsCode: null, quantity: null, unitPrice: null, unitsPerCarton: null, cartons: null, unitWeightKg: null, countryOfOrigin: null };
      draft.items.push(item);
      changes.push({ field: `item:${sku}`, label: `Item ${sku}`, from: null, to: `added${item.description ? ` (${item.description})` : ''}` });
      applyItemFields(item, { ...op, description: undefined }, changes, true);
    } else {
      const item = findItem(draft.items, op);
      if (!item) continue;
      if (op.op === 'remove') {
        draft.items = draft.items.filter((i) => i !== item);
        changes.push({ field: `item:${item.sku}`, label: `Item ${item.sku}`, from: item.description || 'present', to: 'removed' });
      } else applyItemFields(item, op, changes);
    }
  }
  recomputeDerived(draft);
  // derived values moved because items changed
  for (const k of ['cartons', 'declaredValue'] as const) {
    if (draft.derived[k] && draft[k] !== prev[k] && !changes.some((c) => c.field === k)) {
      changes.push({ field: k, label: LABELS[k], from: fmt(prev[k]), to: fmt(draft[k]) });
    }
  }
  return { draft, changes, rejected };
}

function applyItemFields(item: Item, op: ItemOp, changes: Change[], quiet = false) {
  const log = (what: string, from: unknown, to: unknown) => {
    if (!quiet) changes.push({ field: `item:${item.sku}:${what}`, label: `${item.sku} ${itemLabel[what] ?? what}`, from: fmt(from), to: fmt(to) });
  };
  if (op.description?.trim() && op.description.trim() !== item.description) { log('description', item.description, op.description.trim()); item.description = op.description.trim(); }
  if (op.hsCode != null && String(op.hsCode).trim()) { const v = String(op.hsCode).trim(); if (v !== item.hsCode) { log('hsCode', item.hsCode, v); item.hsCode = v; } }
  for (const k of ['quantity', 'unitPrice', 'unitsPerCarton', 'cartons', 'unitWeightKg'] as const) {
    const v = op[k];
    if (isPos(v) && v !== item[k]) { log(k, item[k], v); item[k] = v; }
  }
  if (op.countryOfOrigin?.trim()) {
    const c = canon(op.countryOfOrigin, ITEM_ORIGIN_COUNTRIES) ?? op.countryOfOrigin.trim();
    if (c !== item.countryOfOrigin) { log('countryOfOrigin', item.countryOfOrigin, c); item.countryOfOrigin = c; }
  }
}

/* ------------------------------ missing fields ------------------------------ */
export interface Missing { field: string; label: string; ask: string; itemSku?: string }

export function missingFields(b: Booking): Missing[] {
  const m: Missing[] = [];
  const add = (field: string, label: string, ask: string, itemSku?: string) => m.push({ field, label, ask, itemSku });
  if (!b.items.length) add('items', 'Items', 'What are you shipping (description, quantity and price per unit)?');
  if (!b.originCity) add('originCity', 'Origin city', `Which UK city is it collected from (${ORIGIN_CITIES.join(', ')})?`);
  if (!b.destinationCity) add('destinationCity', 'Destination city', `Which city is it going to (${Object.entries(DESTINATIONS).map(([c, cs]) => `${c}: ${cs.join(', ')}`).join(' · ')})?`);
  if (!b.destinationType) add('destinationType', 'Destination type', 'Is the destination a warehouse or a business address?');
  if (b.destinationType === 'Warehouse' && b.appointmentBooked == null) add('appointmentBooked', 'Delivery appointment', 'Do you have a delivery appointment booked at the warehouse?');
  if (!b.readyDate) add('readyDate', 'Ready date', 'When will the goods be ready for collection?');
  if (!b.priority) add('priority', 'Priority', 'What matters most: cheapest, fastest, most reliable, or a balance?');
  if (b.pallets == null) add('pallets', 'Pallets', 'How many pallets?');
  if (b.grossWeightKg == null) add('grossWeightKg', 'Gross weight', 'What is the total gross weight in kg (goods + cartons + pallets)?');
  if (!b.sellerName) add('sellerName', 'Seller name', 'What is the seller / company name?');
  for (const i of b.items) {
    const miss: string[] = [];
    if (!i.description) miss.push('a description');
    if (i.quantity == null) miss.push('the quantity');
    if (i.unitPrice == null) miss.push('the price per unit (£)');
    if (i.unitsPerCarton == null) miss.push('units per carton');
    if (i.cartons == null) miss.push('number of cartons');
    if (i.unitWeightKg == null) miss.push('the weight of one unit (kg)');
    if (miss.length) add(`item:${i.sku}`, `${i.sku} details`, `For ${i.description || i.sku}: ${miss.join(', ')}?`, i.sku);
  }
  return m;
}

/* -------------------------------- summaries -------------------------------- */
export interface Snapshot {
  pallets: number | null;
  weightPerPallet: number | null;
  carrier: string | null;
  cost: number | null;
  reason: string;
  issueKeys: string[];
  status: string;
}
export function snapshot(r: BookingResult): Snapshot {
  const rec = r.check.recommendation;
  return {
    pallets: r.booking.pallets,
    weightPerPallet: rec.weightPerPallet,
    carrier: rec.recommended?.carrier ?? null,
    cost: rec.recommended?.totalCost ?? null,
    reason: rec.reason,
    issueKeys: r.check.issues.filter((i) => i.severity !== 'Info').map((i) => `${i.ruleId}${i.itemSku ? ':' + i.itemSku : ''}|${i.title}`),
    status: r.check.status,
  };
}

export interface WhatChanged {
  changes: Change[];
  weightPerPallet: [number | null, number | null];
  cost: [number | null, number | null];
  carrier: [string | null, string | null];
  recommendationNote: string;
  resolved: string[];
  introduced: string[];
  statusFrom: string;
  statusTo: string;
}
export function diffSnapshots(a: Snapshot, b: Snapshot, changes: Change[]): WhatChanged {
  const title = (k: string) => k.split('|')[1] + (k.includes(':') && k.split('|')[0].includes(':') ? ` (${k.split('|')[0].split(':')[1]})` : '');
  const resolved = a.issueKeys.filter((k) => !b.issueKeys.includes(k)).map(title);
  const introduced = b.issueKeys.filter((k) => !a.issueKeys.includes(k)).map(title);
  const note = a.carrier === b.carrier
    ? `Recommendation unchanged: ${b.carrier ?? 'none yet'}.`
    : `Recommendation changed from ${a.carrier ?? 'none'} to ${b.carrier ?? 'none'}. ${b.reason}`;
  return { changes, weightPerPallet: [a.weightPerPallet, b.weightPerPallet], cost: [a.cost, b.cost], carrier: [a.carrier, b.carrier], recommendationNote: note, resolved, introduced, statusFrom: a.status, statusTo: b.status };
}

/** Deterministic reply, used when the model is unavailable or the reply call fails. */
export function templateReply(args: { changes: Change[]; rejected: Rejected[]; missing: Missing[]; result: BookingResult | null; derivedNotes: string[] }): string {
  const lines: string[] = [];
  if (args.changes.length) lines.push(`Got it — updated: ${args.changes.map((c) => `${c.label} ${c.from ?? '(blank)'} → ${c.to ?? '(blank)'}`).join('; ')}.`);
  for (const r of args.rejected) lines.push(`I can't use "${r.value}" for ${LABELS[r.field] ?? r.field}. Supported: ${r.options.join(', ')}.`);
  lines.push(...args.derivedNotes);
  if (args.missing.length) {
    lines.push('To finish the booking I still need:');
    args.missing.slice(0, 5).forEach((m, i) => lines.push(`${i + 1}. ${m.ask}`));
  } else if (args.result) {
    const c = args.result.check;
    lines.push(`Your booking is complete. Status: ${c.statusLabel}.${c.issues.filter((i) => i.severity !== 'Info').length ? ` Issues found: ${c.issues.filter((i) => i.severity !== 'Info').map((i) => `${i.severity} — ${i.title}`).join('; ')}.` : ''}`);
    const rec = c.recommendation.recommended;
    if (rec) lines.push(`Recommended: ${rec.carrier} (${rec.service}) at ${money(rec.totalCost ?? 0)}, ${rec.transitDays} days. ${c.recommendation.reason}`);
  }
  return lines.join('\n');
}

export function derivedNotes(b: Booking): string[] {
  const n: string[] = [];
  if (b.derived?.cartons && b.cartons != null) n.push(`I added up the cartons from your items: ${num(b.cartons)} in total — please confirm.`);
  if (b.derived?.declaredValue && b.declaredValue != null) n.push(`I calculated the declared value from your items: ${money(b.declaredValue)} — please confirm.`);
  return n;
}
