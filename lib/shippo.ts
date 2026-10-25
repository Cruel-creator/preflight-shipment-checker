// Live parcel rates for ANY origin/destination via Shippo. Separate from the case-specific
// UK→EU pallet flow, which keeps using its fixed rate card.
export const shippoConfigured = () => !!process.env.SHIPPO_API_KEY;

export interface ShippoAddress { name?: string; street1: string; city: string; state?: string; zip: string; country: string }
export interface ShippoParcel { lengthCm: number; widthCm: number; heightCm: number; weightKg: number }
export type RatePriority = 'Cheapest' | 'Fastest' | 'Balanced';

export interface LiveRate {
  id: string;
  carrier: string;
  service: string;
  amount: number;
  currency: string;
  days: number | null;
  terms: string;
  score?: number;
}
export interface RatesResponse {
  rates: LiveRate[];
  recommended: LiveRate | null;
  reason: string;
  notes: string[];
  carrierMessages: string[];
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export function validateInput(b: { from?: ShippoAddress; to?: ShippoAddress; parcel?: ShippoParcel; priority?: string }): string | null {
  for (const [k, a] of [['Origin', b.from], ['Destination', b.to]] as const) {
    if (!a) return `${k} address is missing.`;
    if (!a.street1?.trim() || !a.city?.trim() || !a.zip?.trim()) return `${k} needs a street, city and postcode.`;
    if (!/^[A-Za-z]{2}$/.test(a.country ?? '')) return `${k} country must be a 2-letter code (e.g. GB, DE, US).`;
    if (['US', 'CA', 'AU'].includes(a.country.toUpperCase()) && !a.state?.trim()) return `${k} needs a state/province for ${a.country.toUpperCase()}.`;
  }
  const p = b.parcel;
  if (!p || !num(p.lengthCm) || !num(p.widthCm) || !num(p.heightCm) || !num(p.weightKg)) return 'Parcel length, width, height and weight must all be positive numbers.';
  if (p.weightKg > 70 || Math.max(p.lengthCm, p.widthCm, p.heightCm) > 270) return 'Parcel is too big for parcel carriers (max 70 kg / 270 cm). Pallet freight needs the UK→EU booking flow.';
  if (b.priority && !['Cheapest', 'Fastest', 'Balanced'].includes(b.priority)) return 'Unknown priority.';
  return null;
}

const addr = (a: ShippoAddress) => ({
  name: a.name?.trim() || 'Name', street1: a.street1.trim(), city: a.city.trim(),
  state: a.state?.trim() || undefined, zip: a.zip.trim(), country: a.country.toUpperCase(),
});

function daysFrom(r: { estimated_days?: number | null; duration_terms?: string | null }): number | null {
  if (typeof r.estimated_days === 'number') return r.estimated_days;
  const m = r.duration_terms?.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:business\s+)?days?/i) ?? r.duration_terms?.match(/(\d+)\s*(?:business\s+)?days?/i);
  return m ? Number(m[m.length > 2 ? 2 : 1]) : null;
}

export async function fetchRates(input: { from: ShippoAddress; to: ShippoAddress; parcel: ShippoParcel; priority?: RatePriority }): Promise<RatesResponse> {
  const key = process.env.SHIPPO_API_KEY;
  if (!key) throw new Error('Live rates are not configured.');
  const res = await fetch('https://api.goshippo.com/shipments/', {
    method: 'POST',
    headers: { Authorization: `ShippoToken ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address_from: addr(input.from), address_to: addr(input.to), async: false,
      parcels: [{ length: String(input.parcel.lengthCm), width: String(input.parcel.widthCm), height: String(input.parcel.heightCm), distance_unit: 'cm', weight: String(input.parcel.weightKg), mass_unit: 'kg' }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : 'Shippo could not price this shipment. Check the addresses.');
  const rates: LiveRate[] = (j.rates ?? []).map((r: Record<string, unknown> & { servicelevel?: { name?: string }; amount: string; currency: string }) => ({
    id: String(r.object_id), carrier: String(r.provider), service: r.servicelevel?.name ?? 'Standard',
    amount: Number(r.amount), currency: r.currency, days: daysFrom(r as { estimated_days?: number | null; duration_terms?: string | null }),
    terms: String(r.duration_terms ?? ''),
  }));
  const carrierMessages: string[] = [...new Set<string>((j.messages ?? []).map((m: { source?: string; text?: string }) => `${m.source ?? 'Carrier'}: ${m.text ?? ''}`))];
  return { ...rank(rates, input.priority ?? 'Cheapest'), carrierMessages };
}

/** Rank within the most common currency (amounts in different currencies aren't comparable). */
export function rank(rates: LiveRate[], priority: RatePriority): Omit<RatesResponse, 'carrierMessages'> {
  const notes: string[] = [];
  if (!rates.length) return { rates, recommended: null, reason: 'No carrier returned a rate for this shipment.', notes };
  const counts = new Map<string, number>();
  rates.forEach((r) => counts.set(r.currency, (counts.get(r.currency) ?? 0) + 1));
  const cur = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const pool = rates.filter((r) => r.currency === cur);
  if (pool.length < rates.length) notes.push(`Some rates are in other currencies and were not ranked (compared in ${cur}).`);
  const timed = pool.filter((r) => r.days != null);
  const cheap = (a: LiveRate, b: LiveRate) => a.amount - b.amount;
  let ordered: LiveRate[];
  if (priority === 'Cheapest' || !timed.length) {
    ordered = [...pool].sort(cheap);
    if (priority !== 'Cheapest') notes.push('Carriers gave no delivery estimates, so the cheapest rate was chosen.');
  } else if (priority === 'Fastest') {
    ordered = [...timed].sort((a, b) => a.days! - b.days! || cheap(a, b));
  } else {
    const cs = timed.map((r) => r.amount), ds = timed.map((r) => r.days!);
    const n = (v: number, lo: number, hi: number) => (hi === lo ? 1 : (hi - v) / (hi - lo));
    timed.forEach((r) => (r.score = 0.5 * n(r.amount, Math.min(...cs), Math.max(...cs)) + 0.5 * n(r.days!, Math.min(...ds), Math.max(...ds))));
    ordered = [...timed].sort((a, b) => b.score! - a.score! || cheap(a, b));
    notes.push('Balanced = 50% price + 50% speed, each scaled 0–1 across the options. Shippo has no on-time-rate data, so reliability is not scored.');
  }
  const eff: RatePriority = priority !== 'Cheapest' && !timed.length ? 'Cheapest' : priority;
  const win = ordered[0];
  const next = ordered[1];
  const label = (r: LiveRate) => `${r.carrier} ${r.service}`;
  let reason = `${label(win)} is ${eff === 'Cheapest' ? 'the lowest price' : eff === 'Fastest' ? 'the fastest' : 'the best balance of price and speed'}: ${win.amount.toFixed(2)} ${win.currency}${win.days != null ? `, about ${win.days} day${win.days === 1 ? '' : 's'}` : ''}.`;
  if (next) {
    const d = win.amount - next.amount;
    reason += ` Next best, ${label(next)}, ${d === 0 ? 'costs the same' : `is ${Math.abs(d).toFixed(2)} ${win.currency} ${d > 0 ? 'cheaper' : 'dearer'}`}${next.days != null && win.days != null && next.days !== win.days ? ` and ${next.days > win.days ? `${next.days - win.days} day(s) slower` : `${win.days - next.days} day(s) faster`}` : ''}.`;
  }
  const sorted = [...rates].sort((a, b) => (a.currency === cur ? 0 : 1) - (b.currency === cur ? 0 : 1) || a.amount - b.amount);
  return { rates: sorted, recommended: win, reason, notes };
}
