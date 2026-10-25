'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DESTINATIONS, PRIORITIES } from '@/lib/data/reference';
import { addDays, londonToday } from '@/lib/dates';
import { longDate, money } from '@/lib/format';
import { recommendCarrier } from '@/lib/recommend';
import type { Booking, Priority } from '@/lib/types';

const FLAG: Record<string, string> = { Germany: '🇩🇪', France: '🇫🇷', Netherlands: '🇳🇱' };
const CITY: Record<string, string> = { Germany: 'Frankfurt', France: 'Paris', Netherlands: 'Amsterdam' };

/** The live quote: the same recommender the booking flows use, fed by three controls. */
export function QuoteBento() {
  const [country, setCountry] = useState('Germany');
  const [pallets, setPallets] = useState(3);
  const [kg, setKg] = useState(250);
  const [priority, setPriority] = useState<Priority>('Cheapest');
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(londonToday()), []);

  const rec = useMemo(() => {
    const b: Booking = {
      bookingId: 'QUOTE', sellerName: null, originCity: 'London', originCountry: 'United Kingdom',
      destinationCity: CITY[country], destinationCountry: country, destinationType: 'Warehouse',
      readyDate: today ? addDays(today, 1) : null, priority, pallets, cartons: null, declaredValue: null,
      currency: 'GBP', grossWeightKg: pallets * kg, appointmentBooked: null, items: [],
    };
    return recommendCarrier(b);
  }, [country, pallets, kg, priority, today]);

  const win = rec.recommended;
  const maxCost = Math.max(...rec.carriers.map((c) => c.totalCost ?? 0), 1);
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-line bg-surface hover:bg-surface2'}`;

  return (
    <>
      <section className="card order-2 p-5 md:col-span-5" aria-label="Instant quote">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Instant quote</h2>
          <span className="label-tag text-muted">live rate card</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Destination country">
          {Object.keys(DESTINATIONS).map((c) => (
            <button key={c} role="radio" aria-checked={c === country} className={chip(c === country)} onClick={() => setCountry(c)}>{FLAG[c]} {c}</button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-surface2 px-4 py-3">
          <span className="text-sm text-muted">Pallets</span>
          <span className="flex items-center gap-3">
            <button aria-label="Fewer pallets" className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface font-bold hover:bg-bg" onClick={() => setPallets((p) => Math.max(1, p - 1))}>−</button>
            <b className="font-display w-6 text-center text-xl" aria-live="polite">{pallets}</b>
            <button aria-label="More pallets" className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface font-bold hover:bg-bg" onClick={() => setPallets((p) => Math.min(20, p + 1))}>+</button>
          </span>
        </div>
        <label className="mt-3 block rounded-xl bg-surface2 px-4 py-3 text-sm">
          <span className="flex justify-between text-muted"><span>Average weight per pallet</span><b className="text-fg">{kg} kg</b></span>
          <input type="range" min={100} max={800} step={50} value={kg} onChange={(e) => setKg(+e.target.value)} className="mt-2 w-full accent-[var(--orange)]" />
          <span className="mt-1 flex justify-between text-[0.7rem] text-muted"><span>A ≤ 500</span><span>C ≤ 400</span><span>B ≤ 750</span></span>
        </label>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Priority">
          {PRIORITIES.map((p) => <button key={p} role="radio" aria-checked={p === priority} className={chip(p === priority)} onClick={() => setPriority(p)}>{p}</button>)}
        </div>
        <div className="mt-4 rounded-2xl border-2 border-[var(--orange)] p-4">
          {win ? (
            <>
              <div className="label-tag text-muted">★ Recommended · {win.carrier} · {win.service}</div>
              <div className="flex items-end justify-between">
                <span className="font-display text-4xl font-bold">{money(win.totalCost ?? 0)}</span>
                <span className="text-right text-sm text-muted">{win.transitDays} days · {win.onTimePct}% on time{win.estimatedDelivery ? <><br />est. {longDate(win.estimatedDelivery)}</> : null}</span>
              </div>
            </>
          ) : <p className="text-sm">No carrier on this route can take {Math.round(kg)} kg pallets (max 750 kg). Try more pallets.</p>}
        </div>
        <Link href="/chat" className="btn btn-primary mt-4 w-full">Check &amp; book this shipment</Link>
      </section>

      <section className="card order-4 p-5 md:col-span-4" aria-label="Carrier comparison">
        <h2 className="font-display text-lg font-bold">Carrier comparison</h2>
        <div className="mt-4 space-y-3 text-sm">
          {rec.carriers.map((c) => {
            const isWin = c.carrier === win?.carrier;
            return (
              <div key={c.carrier} className={c.feasible ? '' : 'opacity-50'}>
                <div className="flex justify-between"><b>{isWin ? '★ ' : ''}{c.carrier}</b><span className="text-muted">{money(c.totalCost ?? 0)} · {c.transitDays} days</span></div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface2"><i className="block h-full rounded-full transition-all duration-500" style={{ width: `${((c.totalCost ?? 0) / maxCost) * 100}%`, background: isWin ? 'var(--orange)' : 'var(--navy)' }} /></div>
                {!c.feasible && <p className="mt-1 text-xs text-muted">✕ {c.infeasibleReason}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted">{rec.reason}</p>
        {rec.notes[0] && <p className="tone-blue mt-2 rounded-lg border px-2 py-1.5 text-xs">ℹ️ {rec.notes[0]}</p>}
      </section>
    </>
  );
}
