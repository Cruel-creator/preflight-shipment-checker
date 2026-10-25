// Simple in-memory per-IP limiter (30 requests / 5 min). Best-effort on serverless:
// each warm instance keeps its own counters, which is enough to blunt casual abuse.
const WINDOW_MS = 5 * 60 * 1000;
const MAX = 30;
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

export function rateLimit(req: Request): { ok: boolean; retryAfterSec: number } {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX) {
    return { ok: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return { ok: true, retryAfterSec: 0 };
}
