'use client';
import { useEffect, useRef, useState } from 'react';
import type { BookingResult } from '@/lib/analyze';
import { emptyBooking, type Missing, type Snapshot, type WhatChanged } from '@/lib/chat';
import { money } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { BookingCard } from '@/components/BookingCard';
import { ResultPanel } from '@/components/ResultPanel';

interface Msg { role: 'user' | 'assistant'; content: string; whatChanged?: WhatChanged | null }
const EXAMPLE = 'I want to send 1,080 mugs from Manchester to a warehouse in Frankfurt, £5 each, on 3 pallets.';
const GREETING = "Hi! I'm the PreFlight booking assistant. Tell me about your shipment in your own words — I'll only ask for what's missing, then check it for problems and recommend a carrier.";

const n1 = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)} kg`);

function WhatChangedCard({ w }: { w: WhatChanged }) {
  return (
    <div className="tone-blue mt-2 rounded-lg border p-3 text-sm">
      <div className="mb-1 font-semibold">🔄 What changed</div>
      <ul className="ml-4 list-disc space-y-0.5">
        {w.changes.map((c, k) => <li key={k}>{c.label}: {c.from ?? '(blank)'} → <b>{c.to ?? '(blank)'}</b></li>)}
        {w.weightPerPallet[0] !== w.weightPerPallet[1] && <li>Weight per pallet: {n1(w.weightPerPallet[0])} → <b>{n1(w.weightPerPallet[1])}</b></li>}
        {w.cost[0] !== w.cost[1] && <li>Freight cost: {w.cost[0] != null ? money(w.cost[0]) : '—'} → <b>{w.cost[1] != null ? money(w.cost[1]) : '—'}</b></li>}
        <li>{w.recommendationNote}</li>
        {w.resolved.length > 0 && <li>✅ Resolved: {w.resolved.join('; ')}</li>}
        {w.introduced.length > 0 && <li>⚠️ New: {w.introduced.join('; ')}</li>}
        {w.statusFrom !== w.statusTo && <li>Status: {w.statusFrom} → <b>{w.statusTo}</b></li>}
      </ul>
    </div>
  );
}

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [draft, setDraft] = useState<Booking>(emptyBooking());
  const [missing, setMissing] = useState<Missing[]>([]);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [today, setToday] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [llmDown, setLlmDown] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [msgs, busy]);

  async function send(content: string) {
    const t = content.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: t }];
    setMsgs(next); setText(''); setBusy(true); setConfirmed(false);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, messages: next.slice(1).map(({ role, content }) => ({ role, content })), prevSnapshot: snap }),
      });
      const j = await res.json().catch(() => ({ error: 'Unexpected response from the server.' }));
      if (!res.ok) throw new Error(j.error || 'Something went wrong.');
      setDraft(j.draft); setMissing(j.missing); setResult(j.result); setSnap(j.snapshot); setToday(j.today); setLlmDown(!j.llmAvailable);
      setMsgs([...next, { role: 'assistant', content: j.reply, whatChanged: j.whatChanged }]);
    } catch (e) {
      setMsgs([...next, { role: 'assistant', content: `Sorry — ${e instanceof Error ? e.message : 'something went wrong'}. Please try again.` }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card flex h-[calc(100vh-9rem)] min-h-[480px] flex-col lg:sticky lg:top-4">
        {llmDown && <div role="status" className="tone-amber border-b px-3 py-2 text-sm">⚠️ The chat assistant is unavailable right now. You can still check bookings with <a className="underline" href="/upload">Upload a file</a>.</div>}
        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'bg-brand text-brandfg' : 'bg-surface2'}`}>
                {m.content}
                {m.whatChanged && <WhatChangedCard w={m.whatChanged} />}
              </div>
            </div>
          ))}
          {msgs.length === 1 && <button className="btn text-left text-sm" onClick={() => send(EXAMPLE)}>💡 Try: “{EXAMPLE}”</button>}
          {busy && <div className="flex items-center gap-2 text-sm text-muted" role="status"><span className="truckbob">🚚</span> Checking your booking…</div>}
          <div ref={end} />
        </div>
        <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input aria-label="Message" className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm" placeholder="Describe your shipment or change a detail…" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} maxLength={2000} />
          <button className="btn btn-primary" disabled={busy || !text.trim()}>Send</button>
        </form>
      </div>

      <div className="space-y-5">
        <BookingCard draft={draft} missing={missing} result={result} />
        {result ? <ResultPanel r={result} today={today} confirmed={confirmed} onConfirm={() => setConfirmed(true)} /> : (
          <div className="card p-4 text-sm text-muted">Checks, the carrier recommendation and your draft invoice appear here once all the details are in.</div>
        )}
      </div>
    </div>
  );
}
