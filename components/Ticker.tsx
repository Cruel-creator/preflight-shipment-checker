import { CARRIERS } from '@/lib/data/reference';
import { DESTINATIONS } from '@/lib/data/reference';

// Real lane data from the fixed rate card: cheapest price/pallet and fastest transit per lane.
const lanes = Object.keys(DESTINATIONS).map((country) => {
  const c = CARRIERS.filter((x) => x.destination === country);
  return `UK → ${country}  ·  from £${Math.min(...c.map((x) => x.pricePerPallet))}/pallet  ·  ${Math.min(...c.map((x) => x.transitDays))}–${Math.max(...c.map((x) => x.transitDays))} days  ·  up to ${Math.max(...c.map((x) => x.onTimePct))}% on time`;
});

export function Ticker() {
  const items = [...lanes, ...lanes, ...lanes, ...lanes];
  return (
    <div className="ticker overflow-hidden border-b border-white/10 bg-[var(--navy)] text-[0.72rem] text-white/80" aria-label="Lane rates from the rate card">
      <div className="ticker-track flex w-max gap-10 py-1.5">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-pre"><span>🚚 {t}</span><span className="text-[var(--orange)]">✦</span></span>
        ))}
      </div>
    </div>
  );
}
