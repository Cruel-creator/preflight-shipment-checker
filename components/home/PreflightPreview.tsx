'use client';
import { useEffect, useState } from 'react';
import { SeverityBadge } from '@/components/ui';
import { addDays, londonToday } from '@/lib/dates';
import { runChecks } from '@/lib/rules';
import type { Booking, CheckResult } from '@/lib/types';

// Dates are computed after mount (the rule engine and invoice number depend on today's date).
function useToday() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(londonToday()), []);
  return today;
}

/** A real run of the rule engine on a sample booking with two planted mistakes. */
export function PreflightPreview() {
  const today = useToday();
  const [check, setCheck] = useState<CheckResult | null>(null);
  useEffect(() => {
    if (!today) return;
    const b: Booking = {
      bookingId: 'BK-DEMO', sellerName: 'Northfield Goods', originCity: 'Manchester', originCountry: 'United Kingdom',
      destinationCity: 'Frankfurt', destinationCountry: 'Germany', destinationType: 'Warehouse', readyDate: addDays(today, 10),
      priority: 'Cheapest', pallets: 3, cartons: 80, declaredValue: 5400, currency: 'GBP', grossWeightKg: 620, appointmentBooked: false,
      items: [{ sku: 'MUG-01', description: 'Ceramic coffee mug, 350 ml', hsCode: '691200', quantity: 1080, unitPrice: 5, unitsPerCarton: 12, cartons: 80, unitWeightKg: 0.5, countryOfOrigin: 'United Kingdom' }],
    };
    setCheck(runChecks(b, { today }));
  }, [today]);

  const red = check?.issues.find((i) => i.severity === 'Red');
  const amber = check?.issues.find((i) => i.severity === 'Amber');
  const pass = check?.passed.find((p) => p.ruleId === 'R-02');
  return (
    <section className="card order-3 p-5 md:col-span-5" aria-label="Pre-flight check preview">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Pre-flight check</h2>
        <span className="tone-red rounded-md border px-2 py-1 text-xs font-bold">⛔ Blocked</span>
      </div>
      <p className="mt-1 text-xs text-muted">A real run of the rules on a sample booking with two planted mistakes.</p>
      <ul className="mt-3 min-h-[220px] space-y-2 text-sm">
        {red && <li className="tone-red rounded-xl border p-3"><span className="flex items-center gap-2"><SeverityBadge s="Red" /><b>{red.ruleId}</b> {red.title}</span><span className="mt-1 block text-xs">{red.whatsWrong}</span><span className="mt-1 block text-xs font-semibold">Fix: {red.howToFix[0]}</span></li>}
        {amber && <li className="tone-amber rounded-xl border p-3"><span className="flex items-center gap-2"><SeverityBadge s="Amber" /><b>{amber.ruleId}</b> {amber.title}</span><span className="mt-1 block text-xs font-semibold">Fix: {amber.howToFix[0]}</span></li>}
        {pass && <li className="tone-green rounded-xl border p-3 text-xs">✅ <b>{pass.ruleId}</b> {pass.label}: {pass.detail}</li>}
        {!check && <li className="rounded-xl bg-surface2 p-3 text-xs text-muted">Running the rules…</li>}
      </ul>
      <a className="mt-3 inline-block text-sm font-semibold text-brand underline underline-offset-4" href="/sample-test-data.xlsx" download>Try it on a sample file →</a>
    </section>
  );
}

export function InvoicePreview() {
  const today = useToday();
  return (
    <section className="card order-5 p-5 md:col-span-3" aria-label="Draft invoice preview">
      <h2 className="font-display text-lg font-bold">Draft invoice</h2>
      <div className="mt-3 rounded-xl border border-dashed border-line bg-surface2 p-3 font-mono text-[11px] leading-relaxed">
        <div className="font-bold">INV-BK-001-{today ? today.replaceAll('-', '') : '········'}</div>
        <div>MUG-01 · HS 691200 · UK</div>
        <div>1,080 × £5.00 = £5,400</div>
        <div>Cartons 1–90 of 90</div>
        <div className="mt-1 rounded bg-[var(--amber-bg)] px-1 text-[var(--amber-fg)]">To complete: buyer address</div>
      </div>
      <p className="mt-3 text-xs text-muted">Pre-filled from the booking; every missing field is highlighted.</p>
    </section>
  );
}
