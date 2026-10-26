'use client';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import gsap from 'gsap';
import { DESTINATIONS, ORIGIN_CITIES, PRIORITIES } from '@/lib/data/reference';
import { addDays, londonToday } from '@/lib/dates';
import { longDate, money } from '@/lib/format';
import { recommendCarrier } from '@/lib/recommend';
import type { Booking, Priority, Recommendation } from '@/lib/types';

const noop = () => () => {};
const CITIES = Object.entries(DESTINATIONS).flatMap(([country, cities]) => cities.map((city) => ({ city, country })));

/** Freight-style booking bar: the same recommender the booking flows use; the estimate is the only figure on the page. */
export function BookingBar() {
  const [from, setFrom] = useState(ORIGIN_CITIES[0]);
  const [to, setTo] = useState('Frankfurt');
  const [pallets, setPallets] = useState(3);
  const [picked, setPicked] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>('Cheapest');
  const [rec, setRec] = useState<Recommendation | null>(null);

  // today depends on the visitor's clock: empty on the server, filled in once hydrated
  const today = useSyncExternalStore(noop, londonToday, () => '');
  const ready = picked ?? (today ? addDays(today, 3) : '');
  useEffect(() => {
    if (rec && !matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.from('#estimate', { y: 12, autoAlpha: 0, duration: 0.45, ease: 'power3.out' });
  }, [rec]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const dest = CITIES.find((c) => c.city === to)!;
    const b: Booking = {
      bookingId: 'QUOTE', sellerName: null, originCity: from, originCountry: 'United Kingdom',
      destinationCity: dest.city, destinationCountry: dest.country, destinationType: 'Warehouse',
      readyDate: ready || null, priority, pallets, cartons: null, declaredValue: null, currency: 'GBP',
      grossWeightKg: null, appointmentBooked: null, items: [],
    };
    setRec(recommendCarrier(b));
  }

  const win = rec?.recommended;
  return (
    <>
      <form className="booking" onSubmit={submit} aria-label="Get an estimate">
        <label className="f"><span className="tag">Collect from</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>{ORIGIN_CITIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <span className="swap" aria-hidden="true">→</span>
        <label className="f"><span className="tag">Deliver to</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>{CITIES.map(({ city, country }) => <option key={city} value={city}>{city}, {country}</option>)}</select>
        </label>
        <div className="f"><span className="tag">Pallets</span>
          <span className="stepper">
            <button type="button" aria-label="Fewer pallets" onClick={() => setPallets((p) => Math.max(1, p - 1))}>−</button>
            <b aria-live="polite">{pallets}</b>
            <button type="button" aria-label="More pallets" onClick={() => setPallets((p) => Math.min(20, p + 1))}>+</button>
          </span>
        </div>
        <label className="f"><span className="tag">Ready on</span>
          <input type="date" value={ready} onChange={(e) => setPicked(e.target.value)} />
        </label>
        <label className="f"><span className="tag">What matters most</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
        </label>
        <button className="btn btn-primary go" type="submit">Get estimate</button>
      </form>
      {rec && (
        <div className="estimate" id="estimate" role="status">
          {win ? (
            <>
              <span className="price">{money(win.totalCost ?? 0)}</span>
              <span className="meta"><b>{win.carrier} · {win.service}</b><br />{win.estimatedDelivery ? `Estimated delivery ${longDate(win.estimatedDelivery)}` : 'Pick a ready date for a delivery estimate'}</span>
              <span className="note">Estimate from the carrier rate card. Your booking is checked before anything is confirmed.</span>
              <Link className="btn btn-white" href="/chat">Check and book</Link>
            </>
          ) : <span className="meta">{rec.reason || 'No carrier can take this shipment on this route.'}</span>}
        </div>
      )}
    </>
  );
}
