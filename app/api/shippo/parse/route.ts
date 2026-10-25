import { NextResponse } from 'next/server';
import { genJson, llmConfigured, MODEL } from '@/lib/llm';
import { rateLimit } from '@/lib/ratelimit';

export const maxDuration = 60;

const addr = {
  type: 'object',
  properties: {
    street1: { type: 'string' }, city: { type: 'string' }, state: { type: 'string', description: 'State/province code if stated' },
    zip: { type: 'string' }, country: { type: 'string', description: 'ISO 3166-1 alpha-2 code, e.g. GB, DE, US, IN' },
  },
};
const SCHEMA = {
  type: 'object',
  properties: {
    from: addr, to: addr,
    parcel: { type: 'object', properties: { lengthCm: { type: 'number' }, widthCm: { type: 'number' }, heightCm: { type: 'number' }, weightKg: { type: 'number' } } },
    priority: { type: 'string', enum: ['Cheapest', 'Fastest', 'Balanced'] },
    goods: {
      type: 'object',
      properties: {
        description: { type: 'string' }, valueAmount: { type: 'number', description: 'Total value, in the currency of the dispatch country' },
        hsCode: { type: 'string' }, originCountry: { type: 'string', description: 'ISO alpha-2 of where the goods were made, only if stated' }, quantity: { type: 'number' },
      },
    },
  },
};

const SYSTEM = `You turn a plain-language description of a parcel shipment into form fields.
Rules: fill in ONLY what the user actually said. Never invent street addresses, postcodes, dimensions, values or HS codes — leave them out. Convert countries to ISO alpha-2 codes (UK = GB). Convert units: lb→kg (×0.4536), oz→kg, inches→cm (×2.54). A city with no street is fine: give the city and country only. "cheapest/cheap" → Cheapest, "fastest/urgent/express/asap" → Fastest, "balanced/best value" → Balanced.`;

export async function POST(req: Request) {
  const rl = rateLimit(req);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec} seconds.` }, { status: 429 });
  if (!llmConfigured()) return NextResponse.json({ error: 'The assistant is unavailable right now. Please fill the form by hand.' }, { status: 503 });
  let text = '';
  try { text = String((await req.json())?.text ?? '').trim(); } catch { /* fall through */ }
  if (!text || text.length > 2000) return NextResponse.json({ error: 'Describe your shipment in up to 2,000 characters.' }, { status: 400 });
  try {
    const out = await genJson<Record<string, unknown>>(MODEL, SYSTEM, [{ role: 'user', content: text }], SCHEMA, 1500);
    return NextResponse.json({ fields: out });
  } catch (e) {
    console.error('shippo parse failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'The assistant could not read that. Please fill the form by hand.' }, { status: 502 });
  }
}
