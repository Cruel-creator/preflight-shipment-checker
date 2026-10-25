'use client';
import { useMemo, useState } from 'react';
import { BALANCED_WEIGHTS } from '@/lib/data/reference';
import { longDate, money } from '@/lib/format';
import { buildInvoiceHtml, invoiceNumber } from '@/lib/invoice';
import type { BookingResult } from '@/lib/analyze';
import type { Issue } from '@/lib/types';
import { SeverityBadge } from './ui';

function IssueCard({ i }: { i: Issue }) {
  const tone = { Red: 'tone-red', Amber: 'tone-amber', Info: 'tone-blue' }[i.severity];
  return (
    <div className="card overflow-hidden">
      <div className={`flex flex-wrap items-center gap-2 border-b px-4 py-2 ${tone}`}>
        <SeverityBadge s={i.severity} />
        <span className="font-semibold">{i.title}</span>
        <span className="ml-auto text-xs opacity-80">{i.ruleId}{i.itemSku ? ` · ${i.itemSku}` : ''}{i.ruleId.startsWith('DATA') ? ' · input problem' : ''}</span>
      </div>
      <div className="space-y-2 px-4 py-3 text-sm">
        <p><b>What&apos;s wrong: </b>{i.whatsWrong}</p>
        <p><b>Why it matters: </b>{i.whyItMatters}</p>
        {i.howToFix.length > 0 && (
          <div><b>How to fix:</b>
            <ul className="ml-5 mt-1 list-disc space-y-1">{i.howToFix.map((f, k) => <li key={k}>{f}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function ResultPanel({ r, today, onConfirm, confirmed }: { r: BookingResult; today: string; onConfirm?: () => void; confirmed?: boolean }) {
  const { check, confirmation: c, booking: b } = r;
  const rec = check.recommendation;
  const [showInvoice, setShowInvoice] = useState(false);
  const invoice = useMemo(() => buildInvoiceHtml(b, c, today), [b, c, today]);
  const tone = { Blocked: 'tone-red', Warnings: 'tone-amber', Ready: 'tone-green' }[check.status];
  const icon = { Blocked: '🔴', Warnings: '🟠', Ready: '✅' }[check.status];
  const groups: ['Red' | 'Amber' | 'Info', string][] = [['Red', 'Red — must fix before shipping'], ['Amber', 'Amber — risky, fix or check'], ['Info', 'Notes']];

  const download = () => {
    const url = URL.createObjectURL(new Blob([invoice], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${invoiceNumber(b, today)}.html`; a.click();
    URL.revokeObjectURL(url);
  };
  const printIt = () => {
    const w = window.open('', '_blank');
    if (!w) return download();
    w.document.write(invoice); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-5">
      {/* 1. status */}
      <div className={`rounded-xl border px-4 py-3 ${tone}`}>
        <div className="text-lg font-bold">{icon} {check.statusLabel}</div>
        <div className="text-sm">{c.statusMessage}</div>
      </div>

      {/* 2. issues */}
      {groups.map(([sev, title]) => {
        const list = check.issues.filter((i) => i.severity === sev);
        return list.length ? (
          <section key={sev} className="space-y-2">
            <h3 className="font-semibold">{title} ({list.length})</h3>
            {list.map((i, k) => <IssueCard key={k} i={i} />)}
          </section>
        ) : null;
      })}

      {/* 3. passed */}
      {check.passed.length > 0 && (
        <details className="card px-4 py-3">
          <summary className="font-semibold">✅ Passed checks ({check.passed.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {check.passed.map((p, k) => <li key={k}>✅ <b>{p.ruleId}</b> {p.label}: <span className="text-muted">{p.detail}</span></li>)}
          </ul>
        </details>
      )}

      {/* 4. carriers */}
      <section className="space-y-2">
        <h3 className="font-semibold">Carrier comparison</h3>
        {rec.carriers.length === 0 ? (
          <p className="text-sm text-muted">{rec.reason}</p>
        ) : (
          <>
            {rec.recommended && <p className="text-sm text-muted">{c.recommendationLabel}{rec.priority ? ` — based on your priority: ${rec.priority}` : ''}</p>}
            <div className="grid gap-3 sm:grid-cols-3">
              {rec.carriers.map((k) => {
                const win = rec.recommended?.carrier === k.carrier;
                return (
                  <div key={k.carrier} className={`card p-3 text-sm ${win ? 'ring-2 ring-[var(--brand)]' : ''} ${!k.feasible ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between">
                      <b>{k.carrier}</b>
                      {win ? <span className="tone-blue rounded-md border px-1.5 text-xs font-bold">★ Recommended</span> : !k.feasible ? <span className="tone-red rounded-md border px-1.5 text-xs font-bold">✕ Can&apos;t take it</span> : null}
                    </div>
                    <div className="text-muted">{k.service}</div>
                    <dl className="mt-2 grid grid-cols-2 gap-y-1">
                      <dt className="text-muted">Total</dt><dd className="font-semibold">{k.totalCost != null ? money(k.totalCost) : '—'}</dd>
                      <dt className="text-muted">Per pallet</dt><dd>{money(k.pricePerPallet)}</dd>
                      <dt className="text-muted">Transit</dt><dd>{k.transitDays} days</dd>
                      <dt className="text-muted">Est. delivery</dt><dd>{k.estimatedDelivery ? longDate(k.estimatedDelivery) : '—'}</dd>
                      <dt className="text-muted">On time</dt><dd>{k.onTimePct}%</dd>
                      <dt className="text-muted">Max / pallet</dt><dd>{k.maxKgPerPallet} kg</dd>
                    </dl>
                    {!k.feasible && <p className="mt-2 text-xs">{k.infeasibleReason}</p>}
                  </div>
                );
              })}
            </div>
            <p className="text-sm">{rec.reason}</p>
            {rec.notes.map((n, k) => <p key={k} className="tone-blue rounded-lg border px-3 py-2 text-sm">ℹ️ {n}</p>)}
            <details className="card px-4 py-3 text-sm">
              <summary className="font-semibold">How we chose</summary>
              <div className="mt-2 space-y-2">
                <p>1. Keep only carriers on the {b.destinationCountry} route. 2. Rule out any carrier whose per-pallet weight limit is below your average ({rec.weightPerPallet != null ? rec.weightPerPallet.toFixed(1) + ' kg' : 'unknown'}). 3. Rank the rest by your priority{rec.priority ? ` (${rec.priority})` : ''}:
                  Cheapest = lowest total cost; Fastest = lowest transit (then higher on-time, then cost); Most reliable = highest on-time (then faster, then cost); Balanced = weighted score below.</p>
                <table className="w-full text-left">
                  <thead><tr className="text-muted"><th>Carrier</th><th>Cost score ({BALANCED_WEIGHTS.cost * 100}%)</th><th>Speed score ({BALANCED_WEIGHTS.speed * 100}%)</th><th>Reliability score ({BALANCED_WEIGHTS.reliability * 100}%)</th><th>Balanced total</th></tr></thead>
                  <tbody>
                    {rec.carriers.map((k) => (
                      <tr key={k.carrier} className={k.feasible ? '' : 'opacity-50'}>
                        <td>{k.carrier}</td>
                        {k.scoreBreakdown ? <>
                          <td>{k.scoreBreakdown.cost.toFixed(2)}</td><td>{k.scoreBreakdown.speed.toFixed(2)}</td><td>{k.scoreBreakdown.reliability.toFixed(2)}</td><td><b>{k.score!.toFixed(3)}</b></td>
                        </> : <td colSpan={4}>excluded by weight</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-muted">Each criterion is scaled 0–1 across the feasible carriers (1 = best). Cost is weighted slightly higher: with equal weights Balanced would always collapse into &quot;Fastest&quot; — moving A→B costs ~£40/pallet more and saves 2 days, but B→C costs ~£120/pallet more for only 1 more day.</p>
                {rec.assumptions.map((a, k) => <p key={k} className="text-muted">• {a}</p>)}
              </div>
            </details>
          </>
        )}
      </section>

      {/* 5. confirmation */}
      <section className="card p-4">
        <h3 className="mb-2 font-semibold">{confirmed ? '🎉 Booking confirmed' : 'Booking confirmation'}</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <dt className="text-muted">Route</dt><dd>{c.route}</dd>
          <dt className="text-muted">Carrier &amp; service</dt><dd>{c.carrierLine ?? '—'}{c.carrierLine && check.status === 'Blocked' ? ' (once issues are fixed)' : ''}</dd>
          <dt className="text-muted">Pallets / cartons / weight</dt><dd>{c.pallets ?? '—'} pallets · {c.cartons ?? '—'} cartons · {c.grossWeightKg ?? '—'} kg</dd>
          <dt className="text-muted">Total freight cost</dt><dd className="font-semibold">{c.totalCost != null ? money(c.totalCost) : '—'}</dd>
          <dt className="text-muted">Collection date</dt><dd>{c.collectionDate ? longDate(c.collectionDate) : '—'}</dd>
          <dt className="text-muted">Estimated delivery</dt><dd>{c.estimatedDelivery ? longDate(c.estimatedDelivery) : '—'} <span className="text-muted">(calendar days)</span></dd>
          <dt className="text-muted">Status</dt><dd>{c.statusLabel}</dd>
        </dl>
        {onConfirm && !confirmed && (
          <button className="btn btn-primary mt-3" onClick={onConfirm} disabled={check.status === 'Blocked'} title={check.status === 'Blocked' ? 'Fix the Red issues first' : ''}>
            {check.status === 'Blocked' ? 'Fix Red issues to confirm' : 'Confirm booking'}
          </button>
        )}
      </section>

      {/* 6. next steps */}
      <section className="card p-4">
        <h3 className="mb-2 font-semibold">What happens next</h3>
        <ol className="ml-5 list-decimal space-y-1 text-sm">
          {c.nextSteps.map((s, k) => <li key={k}>{s.text}{s.advisory && <span className="tone-blue ml-2 rounded border px-1 text-xs">advisory</span>}</li>)}
        </ol>
      </section>

      {/* 7. invoice */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Draft commercial invoice</h3>
          <span className="text-xs text-muted">guidance only — not part of the scored checks</span>
          <div className="ml-auto flex gap-2">
            <button className="btn" onClick={() => setShowInvoice((v) => !v)}>{showInvoice ? 'Hide' : 'View'}</button>
            <button className="btn" onClick={printIt}>Print</button>
            <button className="btn" onClick={download}>Download</button>
          </div>
        </div>
        {showInvoice && <iframe title="Draft commercial invoice" srcDoc={invoice} className="mt-3 h-[640px] w-full rounded-lg border border-line bg-white" />}
      </section>
    </div>
  );
}
