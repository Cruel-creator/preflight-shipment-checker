import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { COUNTRY_PROFILES, profileFor } from '@/lib/countries';
import { checkShipment } from '@/lib/shippoRules';
import { fetchRates, shippoConfigured, validateInput } from '@/lib/shippo';

export const maxDuration = 60;

export async function POST(req: Request) {
  const rl = rateLimit(req);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec} seconds.` }, { status: 429 });
  if (!shippoConfigured()) return NextResponse.json({ error: 'Live rates are not available right now.' }, { status: 503 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const bad = validateInput(body ?? {});
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  try {
    const checks = checkShipment(body);
    const prof = profileFor(body.from.country);
    return NextResponse.json({ ...(await fetchRates(body)), checks, profile: prof ? { name: prof.name, currency: prof.currency } : null, supportedProfiles: prof ? undefined : COUNTRY_PROFILES.map((c) => c.code) });
  } catch (e) {
    console.error('shippo failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Rate lookup failed.' }, { status: 502 });
  }
}
