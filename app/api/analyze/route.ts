import { NextResponse } from 'next/server';
import { analyseMany } from '@/lib/analyze';
import { MAX_ROWS, parseWorkbook } from '@/lib/parse';
import { rateLimit } from '@/lib/ratelimit';
import { llmConfigured } from '@/lib/llm';
import { londonToday } from '@/lib/dates';

export const maxDuration = 60;
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const rl = rateLimit(req);
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many requests. Please try again in ${rl.retryAfterSec} seconds.` }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Could not read the upload. Please send an .xlsx file.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is too large (max 2 MB).' }, { status: 413 });
  if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) return NextResponse.json({ error: 'Please upload an Excel (.xlsx) file.' }, { status: 400 });
  try {
    const parsed = parseWorkbook(new Uint8Array(await file.arrayBuffer()));
    if (!parsed.bookings.length) return NextResponse.json({ error: 'No bookings found in the file.' }, { status: 422 });
    if (parsed.bookings.length > MAX_ROWS) return NextResponse.json({ error: `Too many bookings (max ${MAX_ROWS}).` }, { status: 422 });
    const { results, llmAvailable } = await analyseMany(parsed.bookings);
    return NextResponse.json({ today: londonToday(), results, warnings: parsed.warnings, llmAvailable, llmConfigured: llmConfigured() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read that file.' }, { status: 422 });
  }
}
