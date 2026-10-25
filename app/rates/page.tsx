'use client';
import { useState } from 'react';
import { IssueCard } from '@/components/ResultPanel';
import { ScanLoader } from '@/components/ScanLoader';
import { COUNTRY_OPTIONS, profileFor } from '@/lib/countries';
import type { Issue, PassedCheck } from '@/lib/types';
import type { LiveRate, RatesResponse } from '@/lib/shippo';

const EMPTY = { street1: '', city: '', state: '', zip: '', country: '' };
type Addr = typeof EMPTY;
type Resp = RatesResponse & { checks: { issues: Issue[]; passed: PassedCheck[] }; profile: { name: string; currency: string } | null };

const EXAMPLE_TEXT = 'Send 4 ceramic mugs worth 60 pounds, 3 kg in a 30x25x20 cm box, from 10 Downing Street, London SW1A 2AA to Alexanderplatz 1, Berlin 10178. Cheapest please.';
const inputCls = 'mt-0.5 w-full rounded-lg border border-line bg-surface px-3 py-2';

function AddressFields({ title, v, set, filled }: { title: string; v: Addr; set: (a: Addr) => void; filled: Set<string> }) {
  const f = (k: keyof Addr, label: string, extra = '') => (
    <label className={`block text-sm ${extra}`}>
      <span className="text-muted">{label}</span>
      <input className={`${inputCls} ${filled.has(`${title}.${k}`) ? 'ring-2 ring-[var(--brand)]' : ''}`} value={v[k]} list={k === 'country' ? 'countries' : undefined}
        onChange={(e) => set({ ...v, [k]: k === 'country' ? e.target.value.toUpperCase().slice(0, 2) : e.target.value })} />
    </label>
  );
  const prof = profileFor(v.country);
  return (
    <fieldset className="card grid grid-cols-2 gap-3 p-4">
      <legend className="px-1 font-semibold">{title}{prof ? <span className="ml-2 text-xs font-normal text-muted">{prof.name} · {prof.currency}</span> : null}</legend>
      {f('street1', 'Street address', 'col-span-2')}
      {f('city', 'City')}{f('zip', 'Postcode / ZIP')}
      {f('state', 'State / province (US, CA, AU)')}{f('country', 'Country code (e.g. GB)')}
    </fieldset>
  );
}

export default function RatesPage() {
  const [from, setFrom] = useState<Addr>(EMPTY);
  const [to, setTo] = useState<Addr>(EMPTY);
  const [p, setP] = useState({ l: '', w: '', h: '', kg: '' });
  const [goods, setGoods] = useState({ description: '', value: '', hs: '', origin: '', qty: '1' });
  const [priority, setPriority] = useState<'Cheapest' | 'Fastest' | 'Balanced'>('Cheapest');
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [filled, setFilled] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [res, setRes] = useState<Resp | null>(null);
  const dispatchCur = profileFor(from.country)?.currency;

  async function parse() {
    setParsing(true); setErr(null); setNote(null);
    try {
      const r = await fetch('/api/shippo/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const j = await r.json().catch(() => ({ error: 'Unexpected response.' }));
      if (!r.ok) throw new Error(j.error || 'Failed.');
      const f = j.fields ?? {};
      const hit = new Set<string>();
      const take = (side: 'From' | 'To', cur: Addr, a: Partial<Addr> | undefined): Addr => {
        const next = { ...cur };
        for (const k of Object.keys(EMPTY) as (keyof Addr)[]) if (a?.[k]) { next[k] = k === 'country' ? String(a[k]).toUpperCase().slice(0, 2) : String(a[k]); hit.add(`${side}.${k}`); }
        return next;
      };
      setFrom((c) => take('From', c, f.from)); setTo((c) => take('To', c, f.to));
      if (f.parcel) setP((c) => ({ l: f.parcel.lengthCm ? String(f.parcel.lengthCm) : c.l, w: f.parcel.widthCm ? String(f.parcel.widthCm) : c.w, h: f.parcel.heightCm ? String(f.parcel.heightCm) : c.h, kg: f.parcel.weightKg ? String(f.parcel.weightKg) : c.kg }));
      if (f.goods) setGoods((c) => ({ description: f.goods.description ?? c.description, value: f.goods.valueAmount ? String(f.goods.valueAmount) : c.value, hs: f.goods.hsCode ?? c.hs, origin: f.goods.originCountry ? String(f.goods.originCountry).toUpperCase().slice(0, 2) : c.origin, qty: f.goods.quantity ? String(f.goods.quantity) : c.qty }));
      if (['Cheapest', 'Fastest', 'Balanced'].includes(f.priority)) setPriority(f.priority);
      setFilled(hit);
      setNote('I filled in what you described (outlined in blue). Please check it and complete anything missing — I never guess addresses or values.');
    } catch (x) { setErr(x instanceof Error ? x.message : 'Failed.'); } finally { setParsing(false); }
  }

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/shippo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to, priority,
          parcel: { lengthCm: +p.l, widthCm: +p.w, heightCm: +p.h, weightKg: +p.kg },
          goods: { description: goods.description, valueAmount: goods.value ? +goods.value : undefined, hsCode: goods.hs, originCountry: goods.origin, quantity: goods.qty ? +goods.qty : 1 },
        }),
      });
      const j = await r.json().catch(() => ({ error: 'Unexpected response.' }));
      if (!r.ok) throw new Error(j.error || 'Failed.');
      setRes(j);
    } catch (x) { setErr(x instanceof Error ? x.message : 'Failed.'); } finally { setBusy(false); }
  }

  const price = (r: LiveRate) => res?.dispatchCurrency && r.amountDispatch != null
    ? <>{r.amountDispatch.toFixed(2)} {res.dispatchCurrency}{r.currency !== res.dispatchCurrency && <div className="text-xs font-normal text-muted">quoted {r.amount.toFixed(2)} {r.currency}</div>}</>
    : <>{r.amount.toFixed(2)} {r.currency}</>;
  const row = (r: LiveRate, win: boolean) => (
    <tr key={r.id} className={`border-b border-line last:border-0 ${win ? 'bg-surface2 font-semibold' : ''}`}>
      <td className="px-3 py-2">{win ? '★ ' : ''}{r.carrier}</td><td className="px-3 py-2">{r.service}</td>
      <td className="px-3 py-2 whitespace-nowrap">{price(r)}</td>
      <td className="px-3 py-2">{r.days != null ? `${r.days} day${r.days === 1 ? '' : 's'}` : '—'}</td>
      <td className="px-3 py-2 text-muted font-normal">{r.terms}</td>
    </tr>
  );
  const red = res?.checks.issues.filter((i) => i.severity === 'Red') ?? [];
  const amber = res?.checks.issues.filter((i) => i.severity === 'Amber') ?? [];
  const status = !res ? null : red.length ? ['tone-red', '🔴 Blocked — fix before shipping'] : amber.length ? ['tone-amber', '🟠 Ready with warnings'] : ['tone-green', '✅ Ready to ship'];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Any shipment — live carrier rates</h1>
        <p className="text-sm text-muted">Price a parcel between any two addresses worldwide with live carrier rates from Shippo. Prices and declared values are in the currency of the country you ship from, and checks follow that country&apos;s export rules. This is separate from the UK→EU pallet booking checker, which keeps its own fixed rate card and rulebook. Parcels only (up to 70 kg).</p>
      </div>

      <div className="card space-y-2 p-4">
        <label className="block text-sm font-semibold" htmlFor="nl">Describe your shipment in your own words</label>
        <textarea id="nl" rows={3} maxLength={2000} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE_TEXT} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={parsing || !text.trim()} onClick={parse}>{parsing ? 'Reading…' : 'Fill the form from this'}</button>
          <button type="button" className="btn" onClick={() => setText(EXAMPLE_TEXT)}>Use an example</button>
        </div>
        {note && <p className="tone-blue rounded-lg border px-3 py-2 text-sm">ℹ️ {note}</p>}
      </div>

      <form onSubmit={go} className="space-y-4">
        <datalist id="countries">{COUNTRY_OPTIONS.map((c) => <option key={c} value={c.slice(0, 2)}>{c}</option>)}</datalist>
        <div className="grid gap-4 md:grid-cols-2">
          <AddressFields title="From" v={from} set={setFrom} filled={filled} />
          <AddressFields title="To" v={to} set={setTo} filled={filled} />
        </div>
        <fieldset className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          <legend className="px-1 font-semibold">Parcel &amp; priority</legend>
          {([['l', 'Length (cm)'], ['w', 'Width (cm)'], ['h', 'Height (cm)'], ['kg', 'Weight (kg)']] as const).map(([k, label]) => (
            <label key={k} className="block text-sm"><span className="text-muted">{label}</span>
              <input type="number" min="0" step="any" className={inputCls} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
            </label>
          ))}
          <label className="block text-sm"><span className="text-muted">Priority</span>
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              <option>Cheapest</option><option>Fastest</option><option>Balanced</option>
            </select>
          </label>
        </fieldset>
        <fieldset className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          <legend className="px-1 font-semibold">What&apos;s inside <span className="text-xs font-normal text-muted">(needed for customs on international shipments)</span></legend>
          <label className="col-span-2 block text-sm"><span className="text-muted">Description</span><input className={inputCls} value={goods.description} onChange={(e) => setGoods({ ...goods, description: e.target.value })} /></label>
          <label className="block text-sm"><span className="text-muted">Total value{dispatchCur ? ` (${dispatchCur})` : ''}</span><input type="number" min="0" step="any" className={inputCls} value={goods.value} onChange={(e) => setGoods({ ...goods, value: e.target.value })} /></label>
          <label className="block text-sm"><span className="text-muted">HS code</span><input className={inputCls} value={goods.hs} onChange={(e) => setGoods({ ...goods, hs: e.target.value })} /></label>
          <label className="block text-sm"><span className="text-muted">Made in (country code)</span><input className={inputCls} list="countries" value={goods.origin} onChange={(e) => setGoods({ ...goods, origin: e.target.value.toUpperCase().slice(0, 2) })} /></label>
        </fieldset>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Fetching rates…' : 'Get live rates & check'}</button>
      </form>

      {busy && <ScanLoader label="Fetching live carrier rates…" sub="Asking carriers to price your parcel" />}
      {err && <div role="alert" className="tone-red rounded-lg border px-4 py-3 text-sm">⛔ {err}</div>}

      {res && status && (
        <section className="space-y-4">
          <div className={`rounded-xl border px-4 py-3 font-bold ${status[0]}`}>{status[1]}</div>
          {([['Red', 'Red — must fix before shipping', red], ['Amber', 'Amber — risky, fix or check', amber], ['Info', 'Notes', res.checks.issues.filter((i) => i.severity === 'Info')]] as const).map(([k, title, list]) =>
            list.length ? <div key={k} className="space-y-2"><h3 className="font-semibold">{title} ({list.length})</h3>{list.map((i, n) => <IssueCard key={n} i={i} />)}</div> : null)}
          {res.checks.passed.length > 0 && (
            <details className="card px-4 py-3"><summary className="font-semibold">✅ Passed checks ({res.checks.passed.length})</summary>
              <ul className="mt-2 space-y-1 text-sm">{res.checks.passed.map((c, k) => <li key={k}>✅ <b>{c.ruleId}</b> {c.label}: <span className="text-muted">{c.detail}</span></li>)}</ul></details>
          )}
          <h3 className="font-semibold">Carrier rates{res.dispatchCurrency ? ` (in ${res.dispatchCurrency})` : ''}</h3>
          {res.recommended ? <div className="tone-blue rounded-xl border px-4 py-3"><div className="font-bold">★ Recommended ({priority}){red.length ? ' — once the issues above are fixed' : ''}</div><div className="text-sm">{res.reason}</div></div>
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
