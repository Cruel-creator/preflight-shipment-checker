'use client';
import { useRef, useState } from 'react';
import type { BookingResult } from '@/lib/analyze';
import type { Issue } from '@/lib/types';
import { money } from '@/lib/format';
import { ResultPanel } from '@/components/ResultPanel';
import { StatusBadge } from '@/components/ui';

interface Resp { today: string; results: BookingResult[]; warnings: Issue[]; llmAvailable: boolean; llmConfigured: boolean }

const csvCell = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;

export default function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Resp | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function send(file: File) {
    setBusy(true); setErr(null); setData(null); setSel(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/analyze', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({ error: 'Unexpected response from the server.' }));
      if (!res.ok) throw new Error(j.error || 'Upload failed.');
      setData(j); if (j.results.length === 1) setSel(0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally { setBusy(false); }
  }

  function downloadCsv() {
    if (!data) return;
    const rows = [['booking', 'rule', 'severity', 'item', 'message', 'fix']];
    for (const r of data.results) {
      if (!r.check.issues.length) rows.push([r.booking.bookingId, '', 'OK', '', 'No issues', '']);
      for (const i of r.check.issues) rows.push([r.booking.bookingId, i.ruleId, i.severity, i.itemSku ?? '', `${i.title}: ${i.whatsWrong}`, i.howToFix.join(' | ')]);
    }
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'preflight-results.csv'; a.click();
  }

  const selected = sel != null ? data?.results[sel] : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Upload bookings</h1>
        <p className="text-sm text-muted">Excel file with a <b>Bookings</b> and an <b>Items</b> sheet, same layout as the template (max 2 MB, 500 bookings). <a className="text-brand underline" href="/sample-test-data.xlsx" download>Download a sample file to try</a>.</p>
      </div>

      {!selected && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) send(f); }}
          className={`card flex flex-col items-center gap-2 border-2 border-dashed p-8 text-center ${drag ? 'bg-surface2' : ''}`}
        >
          <div className="text-3xl">📄</div>
          <p>{busy ? 'Checking your bookings…' : 'Drag & drop your .xlsx here'}</p>
          <button className="btn btn-primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Working…' : 'Choose a file'}</button>
          <input ref={input} type="file" accept=".xlsx,.xls,.xlsm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ''; }} />
        </div>
      )}
      {err && <div role="alert" className="tone-red rounded-lg border px-4 py-3 text-sm">⛔ {err}</div>}
      {data && !data.llmAvailable && (
        <div className="tone-amber rounded-lg border px-3 py-2 text-sm">⚠️ The AI assistant is unavailable, so dangerous goods were checked by keywords only and HS code suggestions are off. All other checks ran normally.</div>
      )}

      {data && !selected && (
        <>
          {data.warnings.length > 0 && (
            <div className="tone-amber rounded-lg border px-4 py-3 text-sm">
              <b>Input problems not tied to a booking:</b>
              <ul className="ml-5 list-disc">{data.warnings.map((w, k) => <li key={k}>{w.whatsWrong}</li>)}</ul>
            </div>
          )}
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{data.results.length} booking{data.results.length === 1 ? '' : 's'} checked</h2>
            <button className="btn ml-auto" onClick={downloadCsv}>Download results (CSV)</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>{['Booking', 'Seller', 'Route', 'Status', 'Red', 'Amber', 'Recommended', 'Cost'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.results.map((r, i) => {
                  const rc = r.check.recommendation.recommended;
                  return (
                    <tr key={i} tabIndex={0} role="button" onClick={() => setSel(i)} onKeyDown={(e) => e.key === 'Enter' && setSel(i)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface2">
                      <td className="px-3 py-2 font-semibold">{r.booking.bookingId}</td>
                      <td className="px-3 py-2">{r.booking.sellerName ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.booking.originCity ?? '?'} → {r.booking.destinationCity ?? '?'}, {r.booking.destinationCountry ?? '?'}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.check.status} label={{ Blocked: 'Blocked', Warnings: 'Warnings', Ready: 'Ready' }[r.check.status]} /></td>
                      <td className="px-3 py-2">{r.check.redCount}</td>
                      <td className="px-3 py-2">{r.check.amberCount}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{rc ? `${rc.carrier}${r.check.status === 'Blocked' ? ' *' : ''}` : '—'}</td>
                      <td className="px-3 py-2">{rc?.totalCost != null ? money(rc.totalCost) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">* Recommended once the issues are fixed. Click a row for full details.</p>
        </>
      )}

      {selected && data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {data.results.length > 1 && <button className="btn" onClick={() => setSel(null)}>← All bookings</button>}
            <h2 className="text-xl font-bold">{selected.booking.bookingId} · {selected.booking.sellerName}</h2>
            <StatusBadge status={selected.check.status} />
            <button className="btn ml-auto" onClick={() => { setData(null); setSel(null); }}>Check another file</button>
          </div>
          <ResultPanel r={selected} today={data.today} />
        </div>
      )}
    </div>
  );
}
