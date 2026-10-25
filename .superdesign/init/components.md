# Shared UI components (Next.js 16 App Router, React 19, Tailwind v4, custom components — no UI library)

Brand: placeholder UK cross-border freight company 'Meridian Freight' (navy #12284c + courier orange #ff6a1a on cardboard cream). Shared CSS utility classes (.card, .btn, .btn-primary, .tone-red/amber/green/blue, .label-tag, .tape, .perf, .lift) live in app/globals.css.

### `components/ui.tsx`
```tsx
import type { OverallStatus, Severity } from '@/lib/types';

export function StatusBadge({ status, label }: { status: OverallStatus; label?: string }) {
  const m = {
    Blocked: ['tone-red', '🔴', label ?? 'Blocked'],
    Warnings: ['tone-amber', '🟠', label ?? 'Warnings'],
    Ready: ['tone-green', '✅', label ?? 'Ready'],
  }[status];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${m[0]}`}>{m[1]} {m[2]}</span>;
}

export function SeverityBadge({ s }: { s: Severity }) {
  const m = { Red: ['tone-red', '⛔'], Amber: ['tone-amber', '⚠️'], Info: ['tone-blue', 'ℹ️'] }[s];
  return <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-bold ${m[0]}`}>{m[1]} {s}</span>;
}

```

### `components/Logo.tsx`
```tsx
import { BRAND } from '@/lib/brand';

/** Parcel-and-meridian mark: a box wrapped by an orbit line. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="var(--navy)" />
      <path d="M20 9 31 14.5v11L20 31 9 25.5v-11L20 9Z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 14.5 20 20l11-5.5M20 20v11" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <path d="M20 9 25.5 11.8v5.6" stroke="var(--orange)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="20" cy="20" rx="17" ry="6.5" transform="rotate(-24 20 20)" fill="none" stroke="var(--orange)" strokeWidth="1.6" strokeDasharray="2 3" />
    </svg>
  );
}

export function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <LogoMark />
      <span className="leading-none">
        <span className="font-display block text-[1.05rem] font-bold tracking-tight">{BRAND.name}</span>
        <span className="mt-0.5 hidden text-[0.62rem] sm:block font-semibold uppercase tracking-[0.14em] text-muted">{BRAND.product} · booking checker</span>
      </span>
    </a>
  );
}

```

### `components/Ticker.tsx`
```tsx
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

```

### `components/ScanLoader.tsx`
```tsx
import { ConveyorScene } from '@/components/three/Lazy';

/** Shown while an upload or rate lookup is running: parcels roll through a scanner. */
export function ScanLoader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="card overflow-hidden" role="status" aria-live="polite">
      <div className="h-36 bg-[var(--navy)] sm:h-44">
        <ConveyorScene className="h-full w-full" />
      </div>
      <div className="px-4 py-3">
        <div className="font-display font-bold">{label}</div>
        {sub && <div className="text-sm text-muted">{sub}</div>}
      </div>
    </div>
  );
}

```

### `components/BookingCard.tsx`
```tsx
import type { BookingResult } from '@/lib/analyze';
import { longDate, money, num } from '@/lib/format';
import type { Booking } from '@/lib/types';
import type { Missing } from '@/lib/chat';
import { StatusBadge } from './ui';

const FLAG: Record<string, string[]> = {
  'R-02': ['declaredValue'], 'R-04': ['cartons'], 'R-05': ['pallets', 'grossWeightKg'], 'R-07': ['grossWeightKg'],
  'R-08': ['appointmentBooked'], 'R-10': ['readyDate'], 'DATA-01': ['destinationCity', 'destinationCountry'],
  'DATA-02': ['destinationCity'], 'DATA-07': ['pallets'],
};

export function BookingCard({ draft, missing, result }: { draft: Booking; missing: Missing[]; result: BookingResult | null }) {
  const flagged = new Map<string, 'Red' | 'Amber'>();
  for (const i of result?.check.issues ?? []) {
    if (i.severity === 'Info') continue;
    for (const f of FLAG[i.ruleId] ?? []) if (flagged.get(f) !== 'Red') flagged.set(f, i.severity);
  }
  const missingSet = new Set(missing.map((m) => m.field));
  const fields: [string, string, string | null][] = [
    ['sellerName', 'Seller', draft.sellerName],
    ['originCity', 'From', draft.originCity ? `${draft.originCity}, United Kingdom` : null],
    ['destinationCity', 'To', draft.destinationCity ? `${draft.destinationCity}, ${draft.destinationCountry ?? '?'}` : null],
    ['destinationType', 'Destination type', draft.destinationType],
    ['appointmentBooked', 'Delivery appointment', draft.appointmentBooked == null ? null : draft.appointmentBooked ? 'Booked' : 'Not booked'],
    ['readyDate', 'Ready date', draft.readyDate ? longDate(draft.readyDate) : null],
    ['priority', 'Priority', draft.priority],
    ['pallets', 'Pallets', draft.pallets != null ? String(draft.pallets) : null],
    ['cartons', 'Cartons', draft.cartons != null ? `${num(draft.cartons)}${draft.derived?.cartons ? ' (calculated — please confirm)' : ''}` : null],
    ['declaredValue', 'Declared value', draft.declaredValue != null ? `${money(draft.declaredValue)}${draft.derived?.declaredValue ? ' (calculated — please confirm)' : ''}` : null],
    ['grossWeightKg', 'Gross weight', draft.grossWeightKg != null ? `${num(draft.grossWeightKg, 1)} kg` : null],
  ];
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-semibold">Your booking</h2>
        <span className="ml-auto">{result ? <StatusBadge status={result.check.status} label={result.check.statusLabel} /> : <span className="tone-blue rounded-full border px-2.5 py-0.5 text-xs font-semibold">ℹ️ In progress</span>}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {fields.map(([k, label, v]) => {
          const f = flagged.get(k);
          return (
            <div key={k} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className={v == null ? 'text-muted italic' : ''}>
                {v == null ? (missingSet.has(k) || k === 'destinationCity' ? '○ missing' : '○ not given') : <>{f ? (f === 'Red' ? '⛔ ' : '⚠️ ') : '✓ '}{v}{f && <span className="ml-1 text-xs font-bold">({f})</span>}</>}
              </dd>
            </div>
          );
        })}
      </dl>
      <h3 className="mb-1 mt-3 text-sm font-semibold">Items</h3>
      {draft.items.length === 0 ? <p className="text-sm italic text-muted">○ no items yet</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted"><tr>{['SKU', 'Description', 'Qty', '£/unit', 'Per carton', 'Cartons', 'kg/unit', 'HS', 'Origin'].map((h) => <th key={h} className="pr-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {draft.items.map((i) => (
                <tr key={i.sku} className="border-t border-line">
                  <td className="pr-2">{i.sku}</td><td className="pr-2">{i.description || '○'}</td>
                  {[i.quantity, i.unitPrice, i.unitsPerCarton, i.cartons, i.unitWeightKg].map((v, k) => <td key={k} className="pr-2">{v ?? '○'}</td>)}
                  <td className="pr-2">{i.hsCode ?? '–'}</td><td>{i.countryOfOrigin ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">○ = still needed (HS code and origin are optional to proceed, but missing ones are flagged in the checks).</p>
    </div>
  );
}

```

