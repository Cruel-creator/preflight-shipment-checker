'use client';
import { useState } from 'react';
import type { LiveRate, RatesResponse } from '@/lib/shippo';

const EMPTY = { name: '', street1: '', city: '', state: '', zip: '', country: '' };
type Addr = typeof EMPTY;
const EXAMPLE = {
  from: { name: 'Sender', street1: '10 Downing Street', city: 'London', state: '', zip: 'SW1A 2AA', country: 'GB' },
  to: { name: 'Receiver', street1: 'Alexanderplatz 1', city: 'Berlin', state: '', zip: '10178', country: 'DE' },
};
const COUNTRIES = ['GB United Kingdom', 'DE Germany', 'FR France', 'NL Netherlands', 'US United States', 'CA Canada', 'AU Australia', 'IE Ireland', 'ES Spain', 'IT Italy', 'IN India'];

function AddressFields({ title, v, set }: { title: string; v: Addr; set: (a: Addr) => void }) {
  const f = (k: keyof Addr, label: string, extra = '') => (
    <label className={`block text-sm ${extra}`}>
      <span className="text-muted">{label}</span>
      <input className="mt-0.5 w-full rounded-lg border border-line bg-surface px-3 py-2" value={v[k]} onChange={(e) => set({ ...v, [k]: k === 'country' ? e.target.value.toUpperCase().slice(0, 2) : e.target.value })} list={k === 'country' ? 'countries' : undefined} />
    </label>
  );
  return (
    <fieldset className="card grid grid-cols-2 gap-3 p-4">
      <legend className="px-1 font-semibold">{title}</legend>
      {f('street1', 'Street address', 'col-span-2')}
      {f('city', 'City')}{f('zip', 'Postcode / ZIP')}
      {f('state', 'State / province (US, CA, AU)')}{f('country', 'Country code (e.g. GB)')}
    </fieldset>
  );
}

export default function RatesPage() {
  const [from, setFrom] = useState<Addr>(EMPTY);
  const [to, setTo] = useState<Addr>(EMPTY);
  const [p, setP] = useState({ l: '30', w: '20', h: '10', kg: '2' });
  const [priority, setPriority] = useState<'Cheapest' | 'Fastest' | 'Balanced'>('Cheapest');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<RatesResponse | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/shippo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, priority, parcel: { lengthCm: +p.l, widthCm: +p.w, heightCm: +p.h, weightKg: +p.kg } }),
      });
      const j = await r.json().catch(() => ({ error: 'Unexpected response.' }));
      if (!r.ok) throw new Error(j.error || 'Failed.');
      setRes(j);
    } catch (x) { setErr(x instanceof Error ? x.message : 'Failed.'); } finally { setBusy(false); }
  }
  const row = (r: LiveRate, win: boolean) => (
    <tr key={r.id} className={`border-b border-line last:border-0 ${win ? 'bg-surface2 font-semibold' : ''}`}>
      <td className="px-3 py-2">{win ? '★ ' : ''}{r.carrier}</td><td className="px-3 py-2">{r.service}</td>
      <td className="px-3 py-2 whitespace-nowrap">{r.amount.toFixed(2)} {r.currency}</td>
      <td className="px-3 py-2">{r.days != null ? `${r.days} day${r.days === 1 ? '' : 's'}` : '—'}</td>
      <td className="px-3 py-2 text-muted font-normal">{r.terms}</td>
    </tr>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Any shipment — live carrier rates</h1>
        <p className="text-sm text-muted">Price a parcel between any two addresses worldwide using live carrier rates from Shippo. This is separate from the UK→EU pallet booking checker, which uses its own fixed rate card and rulebook. Rates here are for parcels (up to 70 kg), not pallets.</p>
      </div>
      <form onSubmit={go} className="space-y-4">
        <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c.slice(0, 2)}>{c}</option>)}</datalist>
        <div className="grid gap-4 md:grid-cols-2">
          <AddressFields title="From" v={from} set={setFrom} />
          <AddressFields title="To" v={to} set={setTo} />
        </div>
        <fieldset className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          <legend className="px-1 font-semibold">Parcel &amp; priority</legend>
          {([['l', 'Length (cm)'], ['w', 'Width (cm)'], ['h', 'Height (cm)'], ['kg', 'Weight (kg)']] as const).map(([k, label]) => (
            <label key={k} className="block text-sm"><span className="text-muted">{label}</span>
              <input type="number" min="0" step="any" className="mt-0.5 w-full rounded-lg border border-line bg-surface px-3 py-2" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
            </label>
          ))}
          <label className="block text-sm"><span className="text-muted">Priority</span>
            <select className="mt-0.5 w-full rounded-lg border border-line bg-surface px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              <option>Cheapest</option><option>Fastest</option><option>Balanced</option>
            </select>
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Fetching rates…' : 'Get live rates'}</button>
          <button type="button" className="btn" onClick={() => { setFrom(EXAMPLE.from); setTo(EXAMPLE.to); }}>Fill an example (London → Berlin)</button>
        </div>
      </form>
      {err && <div role="alert" className="tone-red rounded-lg border px-4 py-3 text-sm">⛔ {err}</div>}
      {res && (
        <section className="space-y-3">
          {res.recommended ? <div className="tone-blue rounded-xl border px-4 py-3"><div className="font-bold">★ Recommended ({priority})</div><div className="text-sm">{res.reason}</div></div>
            : <div className="tone-amber rounded-xl border px-4 py-3 text-sm">⚠️ {res.reason}</div>}
          {res.notes.map((n, k) => <p key={k} className="text-sm text-muted">ℹ️ {n}</p>)}
          {res.rates.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-muted"><tr>{['Carrier', 'Service', 'Price', 'Transit', 'Details'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>{res.rates.map((r) => row(r, r.id === res.recommended?.id))}</tbody>
              </table>
            </div>
          )}
          {res.carrierMessages.length > 0 && (
            <details className="card px-4 py-3 text-sm"><summary className="font-semibold">Why some carriers returned no rate</summary>
              <ul className="ml-5 mt-2 list-disc text-muted">{res.carrierMessages.map((m, k) => <li key={k}>{m}</li>)}</ul></details>
          )}
        </section>
      )}
    </div>
  );
}
