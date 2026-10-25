import { NextResponse } from 'next/server';
import { analyseBooking } from '@/lib/analyze';
import {
  applyUpdate, derivedNotes, diffSnapshots, missingFields, snapshot, templateReply,
  type BookingUpdate, type Snapshot, type WhatChanged,
} from '@/lib/chat';
import { londonToday } from '@/lib/dates';
import { DESTINATIONS, ORIGIN_CITIES } from '@/lib/data/reference';
import { getClient, MODEL, reviewItems } from '@/lib/llm';
import { rateLimit } from '@/lib/ratelimit';
import type { Booking } from '@/lib/types';

export const maxDuration = 60;

interface Msg { role: 'user' | 'assistant'; content: string }

const itemProps = {
  sku: { type: 'string', description: 'SKU if the seller gave one; for update/remove it identifies the existing item' },
  description: { type: 'string' },
  hsCode: { type: 'string' },
  quantity: { type: 'number', description: 'Total units of this item' },
  unitPrice: { type: 'number', description: 'GBP per unit' },
  unitsPerCarton: { type: 'number' },
  cartons: { type: 'number', description: 'Cartons of this item' },
  unitWeightKg: { type: 'number' },
  countryOfOrigin: { type: 'string', description: 'Where the product was made' },
};

const TOOL = {
  name: 'update_booking',
  description: 'Record ONLY the booking details the seller stated in their latest message. Omit anything not stated. Never guess or invent values.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sellerName: { type: 'string' },
      originCity: { type: 'string', description: `UK collection city. Supported: ${ORIGIN_CITIES.join(', ')}` },
      destinationCity: { type: 'string', description: 'Pass the city exactly as the seller said it, even if unsupported' },
      destinationCountry: { type: 'string', description: 'Only if the seller named a country' },
      destinationType: { type: 'string', description: '"Warehouse" (fulfilment/distribution centre) or "Business address" (shop, office…)' },
      readyDate: { type: 'string', description: 'ISO yyyy-mm-dd. Resolve "tomorrow", "next Friday", "ASAP" (= today) using today\'s date.' },
      priority: { type: 'string', description: 'Cheapest | Fastest | Most reliable | Balanced. "cheap as possible"→Cheapest, "quick"→Fastest, "no preference"→Balanced' },
      pallets: { type: 'number', description: 'New absolute number of pallets. For "add a pallet" output current + 1.' },
      cartons: { type: 'number', description: 'Total cartons, only if the seller stated a total' },
      declaredValue: { type: 'number', description: 'Total declared value in GBP, only if the seller stated a total' },
      grossWeightKg: { type: 'number', description: 'Total gross weight in kg' },
      appointmentBooked: { type: 'boolean' },
      confirmDerived: { type: 'boolean', description: 'true if the seller confirms the carton total / declared value the assistant calculated' },
      itemOps: {
        type: 'array',
        description: 'Changes to line items',
        items: {
          type: 'object',
          properties: { op: { type: 'string', enum: ['add', 'update', 'remove'] }, ...itemProps },
          required: ['op'],
        },
      },
    },
  },
};

function extractionSystem(draft: Booking, today: string) {
  const weekday = new Date(`${today}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  return `You extract shipment booking details from a seller's chat message for a UK→EU pallet freight service.
Today's date in London is ${today} (${weekday}).
You MUST call update_booking exactly once. Include only what the seller stated in their LATEST message; never invent, assume or compute values the seller did not give (except resolving relative dates, and turning relative changes like "add a pallet" into the new absolute number using the current draft).
Map loose language to allowed values. A city implies its country. If the seller names an unsupported city, pass it through unchanged so the app can respond.
If the seller gives a price per unit for an item, put it in unitPrice. "1,080 mugs at £5 each" = one item: description "mugs", quantity 1080, unitPrice 5. Refer to existing items by their sku. If the message changes the quantity of the only item, use op "update".
Current draft (what is already recorded):
${JSON.stringify({ ...draft, parseIssues: undefined, derived: undefined })}`;
}

const REPLY_SYSTEM = `You are PreFlight's friendly shipment-booking assistant for sellers shipping pallets from the UK to Germany, France or the Netherlands.
You are given FACTS computed by deterministic code (what changed, what is missing, rule-check results, carrier recommendation). Write the next chat reply.
Rules:
- Never contradict or re-decide the FACTS; all rule results and prices come from code. Use the exact numbers given. Do not invent numbers.
- Briefly acknowledge what changed (if anything).
- If values were rejected as unsupported, say so and list the supported options.
- If "missing" is non-empty, ask for ALL of it together in ONE short numbered list (max 5 questions) — do not ask for anything else, and do not ask the seller to do calculations.
- If derivedNotes is non-empty, mention them and ask the seller to confirm.
- If a Red or Amber issue is new or relevant, explain it in one plain sentence (stated vs calculated) and the simplest fix. Red = must be fixed before shipping; Amber = risky.
- When complete (missing is empty): give a 2-3 sentence summary: status, recommended carrier, why (use the supplied reason), and total cost. Tell them they can press "Confirm booking" (if status is not Blocked).
- Warm, concise, plain English. No headings, no tables, minimal markdown.`;

export async function POST(req: Request) {
  const rl = rateLimit(req);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Please try again in ${rl.retryAfterSec} seconds.` }, { status: 429 });

  let body: { draft?: Booking; messages?: Msg[]; prevSnapshot?: Snapshot | null };
  try {
    const raw = await req.text();
    if (raw.length > 200_000) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const draft = body.draft;
  const messages = (body.messages ?? []).filter((m) => m && typeof m.content === 'string').slice(-14);
  if (!draft || !Array.isArray(draft.items) || !messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const today = londonToday();
  const client = getClient();

  // 1. Extract
  let update: BookingUpdate = {};
  let llmOk = !!client;
  if (client) {
    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        output_config: { effort: 'low' },
        system: extractionSystem(draft, today),
        tools: [TOOL],
        tool_choice: { type: 'auto' },
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const tu = res.content.find((b) => b.type === 'tool_use');
      if (tu && tu.type === 'tool_use') update = tu.input as BookingUpdate;
    } catch (e) {
      console.error('extract failed', e instanceof Error ? e.message : e);
      llmOk = false;
    }
  }

  // 2. Merge in code
  const { draft: next, changes, rejected } = applyUpdate(draft, update);
  const missing = missingFields(next);

  // 3. Checks + recommendation once complete
  let result = null;
  let whatChanged: WhatChanged | null = null;
  if (!missing.length) {
    const review = llmOk ? await reviewItems(next.items.map((i) => ({ sku: i.sku, description: i.description, needsHs: !i.hsCode?.trim() }))) : null;
    result = analyseBooking(next, { dangerous: review?.dangerous, hs: review?.hs }, today);
    if (body.prevSnapshot && changes.length) whatChanged = diffSnapshots(body.prevSnapshot, snapshot(result), changes);
  }
  const dNotes = derivedNotes(next);

  // 4. Reply
  let reply = '';
  if (client && llmOk) {
    const facts = {
      changes, rejected: rejected.map((r) => ({ field: r.field, value: r.value, supported: r.options })),
      missing: missing.slice(0, 5).map((m) => m.ask),
      derivedNotes: dNotes,
      booking: { route: `${next.originCity ?? '?'} → ${next.destinationCity ?? '?'}, ${next.destinationCountry ?? '?'}`, pallets: next.pallets, cartons: next.cartons, declaredValue: next.declaredValue, grossWeightKg: next.grossWeightKg, priority: next.priority },
      status: result?.check.statusLabel ?? 'not yet checked (details missing)',
      issues: result?.check.issues.map((i) => ({ rule: i.ruleId, severity: i.severity, title: i.title, whatsWrong: i.whatsWrong, howToFix: i.howToFix[0] })) ?? [],
      recommendation: result ? { carrier: result.check.recommendation.recommended?.carrier, service: result.check.recommendation.recommended?.service, totalCost: result.check.recommendation.recommended?.totalCost, reason: result.check.recommendation.reason, notes: result.check.recommendation.notes } : null,
      whatChanged: whatChanged ? { weightPerPallet: whatChanged.weightPerPallet, cost: whatChanged.cost, recommendation: whatChanged.recommendationNote, resolvedIssues: whatChanged.resolved, newIssues: whatChanged.introduced } : null,
      supportedDestinations: rejected.some((r) => r.field.startsWith('destination')) ? DESTINATIONS : undefined,
    };
    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 1200,
        output_config: { effort: 'low' },
        system: REPLY_SYSTEM,
        messages: [
          ...messages.slice(-6).slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: `Seller's message: ${messages[messages.length - 1].content}\n\nFACTS (from code):\n${JSON.stringify(facts)}` },
        ],
      });
      reply = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
    } catch (e) {
      console.error('reply failed', e instanceof Error ? e.message : e);
    }
  }
  if (!reply) {
    reply = templateReply({ changes, rejected, missing, result, derivedNotes: dNotes });
  }
  if (!llmOk && !changes.length && !rejected.length) {
    reply = 'The chat assistant is unavailable right now, so I could not read that message. You can still use "Upload a file" to check bookings.\n\n' + reply;
  }

  return NextResponse.json({
    draft: next, reply, changes, rejected, missing, result, whatChanged,
    snapshot: result ? snapshot(result) : null,
    today, llmAvailable: llmOk,
  });
}
