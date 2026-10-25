import {
  DESTINATIONS, DESTINATION_TYPES, ITEM_ORIGIN_COUNTRIES, ORIGIN_CITIES, PRIORITIES,
} from '@/lib/data/reference';
import { londonToday, isValidIso } from '@/lib/dates';
import { kg, kgPlain, longDate, money, num } from '@/lib/format';
import { recommendCarrier, weightPerPallet } from '@/lib/recommend';
import type {
  Booking, CheckOptions, CheckResult, Issue, Item, PassedCheck, Recommendation,
} from '@/lib/types';
import { dgHsHeading, scanDescription } from './dangerous';

const EPS = 1e-6;
const round1 = (n: number) => Math.round(n * 10) / 10;
const isNum = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

interface Ctx {
  b: Booking;
  opts: CheckOptions;
  today: string;
  rec: Recommendation;
}
interface RuleOut {
  issues: Issue[];
  passed: PassedCheck[];
}
const out = (issues: Issue[] = [], passed: PassedCheck[] = []): RuleOut => ({ issues, passed });

/* ---------------------------------- R-01 ---------------------------------- */
export function ruleR01({ b, opts }: Ctx): RuleOut {
  const issues: Issue[] = [];
  const bad: string[] = [];
  for (const it of b.items) {
    const raw = it.hsCode?.trim() ?? '';
    const sug = opts.hsSuggestions?.[it.sku];
    const sugLine = sug
      ? [`Suggested — please confirm on the UK Trade Tariff tool: ${sug.code}${sug.note ? ` (${sug.note})` : ''}.`]
      : [];
    const why =
      'Customs uses this code to classify the product and work out duty and rules; without a valid code the shipment can be held at the border.';
    if (!raw) {
      bad.push(it.sku);
      issues.push({
        ruleId: 'R-01', severity: 'Red', itemSku: it.sku,
        title: 'HS code is missing',
        whatsWrong: `${it.sku} (${it.description}) has no HS code. At least 6 digits are required.`,
        whyItMatters: why,
        howToFix: ['Look up the 6-digit (or longer) HS code for this product on the UK Trade Tariff tool and add it.', ...sugLine],
      });
      continue;
    }
    const cleaned = raw.replace(/[\s.]/g, '');
    if (!/^\d+$/.test(cleaned)) {
      bad.push(it.sku);
      issues.push({
        ruleId: 'R-01', severity: 'Red', itemSku: it.sku,
        title: 'HS code is not numeric',
        whatsWrong: `${it.sku} has HS code "${raw}", which contains characters other than digits.`,
        whyItMatters: why,
        howToFix: ['Enter the HS code as digits only (spaces and dots are fine), at least 6 digits.', ...sugLine],
      });
    } else if (cleaned.length < 6) {
      bad.push(it.sku);
      const fix: string[] = [];
      let extra = '';
      if (cleaned.length === 5) {
        const padded = '0' + cleaned;
        extra = ` Excel may have dropped a leading zero (e.g. 090111 stored as 90111) — did you mean ${padded}?`;
        fix.push(`If this is a leading-zero code, the correct value is probably ${padded}. Please confirm before using it.`);
      }
      fix.push('Look up the full 6-digit (or longer) code on the UK Trade Tariff tool and enter it as text so Excel keeps leading zeros.', ...sugLine);
      issues.push({
        ruleId: 'R-01', severity: 'Red', itemSku: it.sku,
        title: `HS code too short (${cleaned.length} digits)`,
        whatsWrong: `${it.sku} has HS code "${raw}" — only ${cleaned.length} digits; at least 6 are required.${extra}`,
        whyItMatters: why,
        howToFix: fix,
      });
    }
  }
  if (!b.items.length) return out();
  return out(issues, issues.length ? [] : [
    { ruleId: 'R-01', label: 'HS codes present', detail: `All ${b.items.length} item${b.items.length === 1 ? ' has' : 's have'} an HS code of 6+ digits.` },
  ]);
}

/* ---------------------------------- R-02 ---------------------------------- */
export function computedValue(items: Item[]): number | null {
  if (items.some((i) => !isNum(i.quantity) || !isNum(i.unitPrice))) return null;
  return items.reduce((s, i) => s + i.quantity! * i.unitPrice!, 0);
}
export function ruleR02({ b }: Ctx): RuleOut {
  if (!b.items.length || !isNum(b.declaredValue)) return out();
  const computed = computedValue(b.items);
  if (computed == null) return out();
  const diff = b.declaredValue - computed;
  const breakdown = b.items.map((i) => `${num(i.quantity!)} × ${money(i.unitPrice!)}`).join(' + ');
  const pct = computed === 0 ? (b.declaredValue === 0 ? 0 : Infinity) : Math.abs(diff) / computed;
  if (pct <= 0.01 + EPS) {
    return out([], [{
      ruleId: 'R-02', label: 'Value adds up',
      detail: `${breakdown} = ${money(computed)}; declared ${money(b.declaredValue)}.`,
    }]);
  }
  return out([{
    ruleId: 'R-02', severity: 'Red',
    title: "Declared value doesn't match the items",
    whatsWrong: `Declared value is ${money(b.declaredValue)} but the items add up to ${money(computed)} (${breakdown}). Difference: ${money(Math.abs(diff))} ${diff > 0 ? 'too high' : 'too low'}${computed ? ` (${(pct * 100).toFixed(1)}%; the allowed tolerance is 1%)` : ''}.`,
    whyItMatters: 'Customs duty and VAT are calculated on the declared value. A mismatch can trigger a customs query, a hold, or a penalty for under-declaring.',
    howToFix: [
      `If the item prices and quantities are right, change the declared value to ${money(computed)}.`,
      'If the declared value is right, check the unit prices and quantities on each item.',
    ],
  }]);
}

/* ---------------------------------- R-03 ---------------------------------- */
export function r03Fails(it: Item): boolean {
  return isNum(it.unitsPerCarton) && isNum(it.cartons) && isNum(it.quantity) &&
    Math.abs(it.unitsPerCarton * it.cartons - it.quantity) > EPS;
}
export function ruleR03({ b }: Ctx): RuleOut {
  const issues: Issue[] = [];
  const ok: string[] = [];
  for (const it of b.items) {
    if (!isNum(it.unitsPerCarton) || !isNum(it.cartons) || !isNum(it.quantity)) continue;
    if (!r03Fails(it)) { ok.push(`${it.sku}: ${num(it.unitsPerCarton)} × ${num(it.cartons)} = ${num(it.quantity)}`); continue; }
    const calc = it.unitsPerCarton * it.cartons;
    const needed = it.unitsPerCarton > 0 ? it.quantity / it.unitsPerCarton : NaN;
    const neededTxt = Number.isInteger(needed)
      ? `${needed}`
      : `${num(needed, 2)}, so ${Math.ceil(needed)} with the last carton part-filled — note that on the packing list`;
    issues.push({
      ruleId: 'R-03', severity: 'Red', itemSku: it.sku,
      title: "Box count doesn't add up",
      whatsWrong: `${it.sku}: ${num(it.unitsPerCarton)} units per carton × ${num(it.cartons)} cartons = ${num(calc)} units, but the quantity says ${num(it.quantity)} (${num(Math.abs(calc - it.quantity))} ${calc > it.quantity ? 'more' : 'fewer'}). It isn't clear which field is wrong.`,
      whyItMatters: `The receiving warehouse counts cartons against your paperwork — they will report ${num(Math.abs(calc - it.quantity))} units ${calc < it.quantity ? 'missing' : 'unexpected'}, which causes disputes and delays booking-in.`,
      howToFix: [
        isFinite(needed)
          ? `If the quantity (${num(it.quantity)}) is right, cartons should be ${num(it.quantity)} ÷ ${num(it.unitsPerCarton)} = ${neededTxt}.`
          : 'Units per carton must be above zero.',
        `If the cartons (${num(it.cartons)}) are right, the quantity should be ${num(it.unitsPerCarton)} × ${num(it.cartons)} = ${num(calc)}.`,
      ],
    });
  }
  return out(issues, issues.length || !ok.length ? [] : [
    { ruleId: 'R-03', label: 'Box counts add up', detail: ok.join('; ') + '.' },
  ]);
}

/* ---------------------------------- R-04 ---------------------------------- */
export function ruleR04({ b }: Ctx): RuleOut {
  if (!isNum(b.cartons) || !b.items.length || b.items.some((i) => !isNum(i.cartons))) return out();
  const sum = b.items.reduce((s, i) => s + i.cartons!, 0);
  if (Math.abs(sum - b.cartons) <= EPS) {
    return out([], [{ ruleId: 'R-04', label: 'Carton total matches', detail: `Booking has ${num(b.cartons)} cartons = sum of items (${b.items.map((i) => num(i.cartons!)).join(' + ')}).` }]);
  }
  // Is an R-03 failure the likely root cause? Try swapping in qty ÷ units-per-carton for failing items.
  const failing = b.items.filter((i) => r03Fails(i) && i.unitsPerCarton! > 0);
  const fixedCartons = (i: Item) => Math.ceil(i.quantity! / i.unitsPerCarton!);
  const single = failing.filter((i) => Math.abs(sum - i.cartons! + fixedCartons(i) - b.cartons!) <= EPS);
  const allSum = sum + failing.reduce((s, i) => s + fixedCartons(i) - i.cartons!, 0);
  const culprits = single.length ? single : failing.length && Math.abs(allSum - b.cartons) <= EPS ? failing : [];
  const fix = [
    `If the item cartons are right, change the booking's carton total to ${num(sum)}.`,
    `If the booking total (${num(b.cartons)}) is right, the item carton counts need correcting so they add up to ${num(b.cartons)}.`,
  ];
  let rootCause = '';
  if (culprits.length) {
    const who = culprits.map((i) => i.sku).join(', ');
    const detail = culprits.map((i) => `${i.sku} should have ${fixedCartons(i)} cartons (${num(i.quantity!)} ÷ ${num(i.unitsPerCarton!)}), not ${num(i.cartons!)}`).join('; ');
    rootCause = ` Likely root cause: the box-count problem on ${who} (rule R-03) — ${detail}. Fixing it makes the items add up to ${num(b.cartons)}, so one fix resolves both.`;
    fix.unshift(`Fix ${who} first (R-03) — that is probably the real mistake, and this issue will clear with it.`);
  }
  return out([{
    ruleId: 'R-04', severity: 'Red',
    title: "Total cartons don't match the items",
    whatsWrong: `The booking says ${num(b.cartons)} cartons but the items add up to ${num(sum)} (${b.items.map((i) => `${i.sku}: ${num(i.cartons!)}`).join(' + ')}).${rootCause}`,
    whyItMatters: 'The carrier and the warehouse count cartons against the booking. A wrong total means cartons are reported missing or extra at the dock.',
    howToFix: fix,
  }]);
}

/* ---------------------------------- R-05 ---------------------------------- */
export function ruleR05({ b, rec }: Ctx): RuleOut {
  const wpp = weightPerPallet(b);
  if (wpp == null || !rec.carriers.length) return out();
  const wppTxt = kg(round1(wpp));
  const issues: Issue[] = [];
  if (!rec.recommended && rec.carriers.every((c) => !c.feasible)) {
    const gross = b.grossWeightKg!;
    const opts = rec.carriers.map((c) => {
      const n = Math.ceil(gross / c.maxKgPerPallet - 1e-9);
      return { c, n, wpp: gross / n, cost: c.pricePerPallet * n };
    });
    const byB = opts.find((o) => o.c.maxKgPerPallet === 750)!;
    const lines = opts.map(
      (o) => `${o.n} pallets → ${kg(round1(o.wpp))} per pallet → ${o.c.carrier} (${o.c.service}) possible, total ${money(o.cost)}`,
    );
    issues.push({
      ruleId: 'R-05', severity: 'Red',
      title: 'Pallets too heavy for every carrier',
      whatsWrong: `${kgPlain(gross)} ÷ ${num(b.pallets!)} pallet${b.pallets === 1 ? '' : 's'} = ${wppTxt} per pallet, above the 750 kg maximum of the heaviest-rated carrier on this route (Carrier B). Carrier A takes 500 kg and Carrier C 400 kg.`,
      whyItMatters: 'The carrier will refuse overweight pallets at collection, or they can be unsafe to handle, so the shipment cannot go as booked.',
      howToFix: [
        `Minimum fix: split onto at least ${byB.n} pallets (${kg(round1(byB.wpp))} per pallet, Carrier B total ${money(byB.cost)}).`,
        ...lines.filter((_, i) => opts[i].c.maxKgPerPallet !== 750).map((l) => `To unlock another carrier: ${l}.`),
        'Or reduce the weight of the shipment.',
      ],
    });
    return out(issues);
  }
  if (rec.excludedPreferred && rec.recommended) {
    const ex = rec.excludedPreferred;
    issues.push({
      ruleId: 'R-05', severity: 'Info',
      title: `${ex.carrier} ruled out by weight`,
      whatsWrong: `Your priority (${rec.priority}) would pick ${ex.carrier}, but pallets average ${wppTxt} and ${ex.carrier} accepts at most ${ex.maxKgPerPallet} kg. ${rec.recommended.carrier} (limit ${rec.recommended.maxKgPerPallet} kg) was chosen instead — this is not an error.`,
      whyItMatters: 'Nothing is blocked; the recommendation already accounts for the weight limit.',
      howToFix: rec.notes.filter((n) => n.startsWith('Splitting')),
    });
  }
  const rc = rec.recommended;
  return out(issues, rc ? [{
    ruleId: 'R-05', label: 'Pallet weight within carrier limit',
    detail: `${kgPlain(b.grossWeightKg!)} ÷ ${num(b.pallets!)} = ${wppTxt} per pallet, within ${rc.carrier}'s ${rc.maxKgPerPallet} kg limit.`,
  }] : []);
}

/* ---------------------------------- R-06 ---------------------------------- */
export function ruleR06({ b, opts }: Ctx): RuleOut {
  const issues: Issue[] = [];
  for (const it of b.items) {
    const kw = scanDescription(it.description ?? '');
    const hs = dgHsHeading(it.hsCode);
    const llm = opts.llmDangerous?.[it.sku];
    const reasons: string[] = [];
    if (kw) reasons.push(kw.reason);
    if (hs) reasons.push(`HS code ${it.hsCode} falls under heading ${hs}, which covers batteries.`);
    if (llm?.isDangerous) reasons.push(`AI description check: ${llm.category ? llm.category + ' — ' : ''}${llm.reason ?? 'looks like dangerous goods'}.`);
    if (!reasons.length) continue;
    issues.push({
      ruleId: 'R-06', severity: 'Red', itemSku: it.sku,
      title: kw?.keyword === 'perfume' && reasons.length === 1 ? 'Possible dangerous goods — check (perfume)' : 'Possible dangerous goods',
      whatsWrong: `${it.sku} ("${it.description}"): ${reasons.join(' ')}`,
      whyItMatters: 'Lithium batteries, aerosols and flammable liquids are regulated dangerous goods. Undeclared, they can be seized, fined, or refused by the carrier — and they are a safety risk in transit.',
      howToFix: [
        'Remove this item from the shipment; dangerous goods need a specialist DG service, which these carriers do not offer.',
        'If the product is actually safe (e.g. battery-free, non-flammable), correct the description to say so and re-check.',
      ],
    });
  }
  if (!b.items.length) return out();
  return out(issues, issues.length ? [] : [
    { ruleId: 'R-06', label: 'No dangerous goods spotted', detail: `Checked ${b.items.length} description${b.items.length === 1 ? '' : 's'}${opts.llmDangerous ? ' by keyword, HS heading and AI backstop' : ' by keyword and HS heading'}.` },
  ]);
}

/* ---------------------------------- R-07 ---------------------------------- */
export function ruleR07({ b }: Ctx): RuleOut {
  if (!isNum(b.grossWeightKg) || !b.items.length || b.items.some((i) => !isNum(i.unitWeightKg) || !isNum(i.quantity))) return out();
  const net = b.items.reduce((s, i) => s + i.unitWeightKg! * i.quantity!, 0);
  if (b.grossWeightKg + EPS >= net) {
    return out([], [{ ruleId: 'R-07', label: 'Gross weight covers the goods', detail: `Gross ${kgPlain(b.grossWeightKg)} ≥ goods ${kg(round1(net))}.` }]);
  }
  return out([{
    ruleId: 'R-07', severity: 'Amber',
    title: 'Gross weight is lighter than the goods alone',
    whatsWrong: `Gross weight is ${kgPlain(b.grossWeightKg)} but the goods alone weigh ${kg(round1(net))} (${b.items.map((i) => `${num(i.quantity!)} × ${num(i.unitWeightKg!, 3)} kg`).join(' + ')}), before cartons and pallets.`,
    whyItMatters: 'A gross weight that is too low means freight is under-charged and then re-billed, and weight checks at collection or customs can flag it.',
    howToFix: [`Re-weigh the shipment. Gross weight includes goods, cartons and pallets, so it should be at least ${kg(round1(net))}.`],
  }]);
}

/* ---------------------------------- R-08 ---------------------------------- */
export function ruleR08({ b, rec }: Ctx): RuleOut {
  if (b.destinationType === 'Warehouse' && b.appointmentBooked === false) {
    const eta = rec.recommended?.estimatedDelivery;
    return out([{
      ruleId: 'R-08', severity: 'Amber',
      title: 'No delivery appointment booked',
      whatsWrong: `The delivery is to a warehouse and no appointment slot is booked.`,
      whyItMatters: 'Warehouses often refuse or delay unannounced deliveries, so the truck may queue or be turned away and you pay for the redelivery.',
      howToFix: [`Book a slot with the receiving warehouse before the estimated delivery date${eta ? ` (${longDate(eta)} with ${rec.recommended!.carrier})` : ''}, then set "Delivery appointment booked" to Yes.`],
    }]);
  }
  if (b.destinationType === 'Warehouse' && b.appointmentBooked === true) {
    return out([], [{ ruleId: 'R-08', label: 'Delivery appointment booked', detail: 'Warehouse delivery has a booked slot.' }]);
  }
  if (b.destinationType === 'Business address') {
    return out([], [{ ruleId: 'R-08', label: 'No appointment needed', detail: 'Delivery is to a business address, not a warehouse.' }]);
  }
  return out();
}

/* ---------------------------------- R-09 ---------------------------------- */
export function ruleR09({ b }: Ctx): RuleOut {
  const issues: Issue[] = [];
  for (const it of b.items) {
    if (it.countryOfOrigin?.trim()) continue;
    issues.push({
      ruleId: 'R-09', severity: 'Amber', itemSku: it.sku,
      title: 'Country of origin is missing',
      whatsWrong: `${it.sku} (${it.description}) has no country of origin.`,
      whyItMatters: 'Customs needs the origin of goods to apply the right duty rate and origin rules; a blank can cause questions or delays.',
      howToFix: ['Add where the product was made, not where it ships from.'],
    });
  }
  if (!b.items.length) return out();
  return out(issues, issues.length ? [] : [
    { ruleId: 'R-09', label: 'Country of origin given', detail: `All ${b.items.length} item${b.items.length === 1 ? ' has' : 's have'} a country of origin.` },
  ]);
}

/* ---------------------------------- R-10 ---------------------------------- */
export function ruleR10({ b, today }: Ctx): RuleOut {
  if (!b.readyDate || !isValidIso(b.readyDate)) return out();
  if (b.readyDate < today) {
    return out([{
      ruleId: 'R-10', severity: 'Amber',
      title: 'Ready date is in the past',
      whatsWrong: `Ready to ship date is ${longDate(b.readyDate)}, but today (London time) is ${longDate(today)}.`,
      whyItMatters: 'The carrier cannot collect on a date that has passed, and delivery estimates based on it will be wrong.',
      howToFix: ['Choose today or a later date.'],
    }]);
  }
  return out([], [{ ruleId: 'R-10', label: 'Ready date is not in the past', detail: `${longDate(b.readyDate)} (today is ${longDate(today)}).` }]);
}

/* -------------------------------- DATA checks ------------------------------ */
const dataIssue = (id: string, severity: Issue['severity'], title: string, whatsWrong: string, howToFix: string[], why = 'This is an input problem, not a rulebook rule: the app cannot check the booking reliably until it is fixed.'): Issue => ({
  ruleId: id, severity, title, whatsWrong, whyItMatters: why, howToFix,
});

export function dataChecks(b: Booking): Issue[] {
  const issues: Issue[] = [...(b.parseIssues ?? [])];
  const dest = b.destinationCountry;
  if (dest && !(dest in DESTINATIONS)) {
    issues.push(dataIssue('DATA-02', 'Red', 'Unsupported destination country', `"${dest}" is not supported. Supported: ${Object.keys(DESTINATIONS).join(', ')}.`, [`Choose one of: ${Object.keys(DESTINATIONS).join(', ')}.`]));
  } else if (dest && b.destinationCity && !DESTINATIONS[dest].includes(b.destinationCity)) {
    const inOther = Object.entries(DESTINATIONS).find(([, cs]) => cs.includes(b.destinationCity!))?.[0];
    issues.push(dataIssue('DATA-01', 'Red', 'Destination city is not in the destination country',
      `${b.destinationCity} is not a supported city in ${dest}${inOther ? ` — ${b.destinationCity} is in ${inOther}` : ''}.`,
      [inOther ? `If the city is right, change the country to ${inOther}. If ${dest} is right, choose one of: ${DESTINATIONS[dest].join(', ')}.` : `Choose one of: ${DESTINATIONS[dest].join(', ')}.`],
      'Carrier prices and transit times depend on the destination country, so a mismatched city and country means the quote — and the delivery — could be wrong.'));
  } else if (!dest && b.destinationCity && !Object.values(DESTINATIONS).flat().includes(b.destinationCity)) {
    issues.push(dataIssue('DATA-02', 'Red', 'Unsupported destination city', `"${b.destinationCity}" is not supported. Options: ${Object.entries(DESTINATIONS).map(([c, cs]) => `${c}: ${cs.join(', ')}`).join(' · ')}.`, ['Choose a supported city.']));
  }
  if (b.originCity && !ORIGIN_CITIES.includes(b.originCity)) {
    issues.push(dataIssue('DATA-02', 'Red', 'Unsupported origin city', `"${b.originCity}" is not a supported UK origin city. Options: ${ORIGIN_CITIES.join(', ')}.`, [`Choose one of: ${ORIGIN_CITIES.join(', ')}.`]));
  }
  if (b.destinationType && !(DESTINATION_TYPES as readonly string[]).includes(b.destinationType)) {
    issues.push(dataIssue('DATA-02', 'Red', 'Unsupported destination type', `"${b.destinationType}" is not allowed.`, ['Use Warehouse or Business address.']));
  }
  if (b.priority && !(PRIORITIES as readonly string[]).includes(b.priority)) {
    issues.push(dataIssue('DATA-02', 'Red', 'Unsupported seller priority', `"${b.priority}" is not allowed.`, [`Use one of: ${PRIORITIES.join(', ')}.`]));
  }
  for (const it of b.items) {
    if (it.countryOfOrigin?.trim() && !ITEM_ORIGIN_COUNTRIES.includes(it.countryOfOrigin.trim())) {
      issues.push({ ...dataIssue('DATA-02', 'Info', 'Unrecognised country of origin', `${it.sku}: "${it.countryOfOrigin}" is not in the usual list (${ITEM_ORIGIN_COUNTRIES.join(', ')}). It is accepted, but please check the spelling.`, ['Check the spelling or confirm the country.']), itemSku: it.sku });
    }
  }
  if (!b.items.length) {
    issues.push(dataIssue('DATA-03', 'Red', 'Booking has no items', `${b.bookingId} has no rows on the Items sheet, so value, cartons, HS codes and dangerous goods cannot be checked.`, ['Add at least one item row with this Booking ID.']));
  }
  if (b.pallets != null && b.pallets <= 0) {
    issues.push(dataIssue('DATA-07', 'Red', 'Pallets must be at least 1', `Pallets is ${b.pallets}. Weight per pallet and cost cannot be worked out.`, ['Enter the number of pallets (1 or more).']));
  } else if (b.pallets != null && !Number.isInteger(b.pallets)) {
    issues.push(dataIssue('DATA-06', 'Red', 'Pallets must be a whole number', `Pallets is ${b.pallets}.`, ['Enter a whole number of pallets.']));
  }
  return issues;
}

/* ---------------------------------- runner --------------------------------- */
const RULES = [ruleR01, ruleR02, ruleR03, ruleR04, ruleR05, ruleR06, ruleR07, ruleR08, ruleR09, ruleR10];
const sevOrder = { Red: 0, Amber: 1, Info: 2 } as const;

export function runChecks(b: Booking, opts: CheckOptions = {}): CheckResult {
  const today = opts.today ?? londonToday();
  const rec = recommendCarrier(b);
  const ctx: Ctx = { b, opts, today, rec };
  const issues: Issue[] = [...dataChecks(b)];
  const passed: PassedCheck[] = [];
  for (const rule of RULES) {
    const r = rule(ctx);
    issues.push(...r.issues);
    passed.push(...r.passed);
  }
  issues.sort((a, c) => sevOrder[a.severity] - sevOrder[c.severity] || a.ruleId.localeCompare(c.ruleId));
  const redCount = issues.filter((i) => i.severity === 'Red').length;
  const amberCount = issues.filter((i) => i.severity === 'Amber').length;
  const status = redCount ? 'Blocked' : amberCount ? 'Warnings' : 'Ready';
  const statusLabel = { Blocked: 'Blocked — fix before shipping', Warnings: 'Ready with warnings', Ready: 'Ready to ship' }[status];
  return { issues, passed, status, statusLabel, recommendation: rec, redCount, amberCount };
}
