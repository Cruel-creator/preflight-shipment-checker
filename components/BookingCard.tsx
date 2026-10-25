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
