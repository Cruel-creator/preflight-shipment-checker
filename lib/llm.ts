import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { HsSuggestion, LlmDangerousHit } from '@/lib/types';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const FAST_MODEL = process.env.GEMINI_FAST_MODEL || 'gemini-3.5-flash-lite';

export const llmConfigured = () => !!process.env.GEMINI_API_KEY;
let client: GoogleGenAI | null = null;
export function getClient(): GoogleGenAI | null {
  if (!llmConfigured()) return null;
  return (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { timeout: 40_000 } }));
}

// Full-size Gemini 3 models think for ~10s by default; LOW keeps replies at ~2s. Lite models don't accept it.
const thinking = (model: string) => (/lite/i.test(model) ? undefined : { thinkingLevel: ThinkingLevel.LOW });

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
const toContents = (turns: ChatTurn[]) =>
  turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] }));

/** Structured JSON generation. Throws on failure; callers catch and fall back. */
export async function genJson<T>(model: string, system: string, turns: ChatTurn[], schema: object, maxOutputTokens = 4000): Promise<T> {
  const c = getClient();
  if (!c) throw new Error('LLM not configured');
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await c.models.generateContent({
        model,
        contents: toContents(turns),
        config: { systemInstruction: system, responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens, temperature: 0, thinkingConfig: thinking(model) },
      });
      return JSON.parse(res.text ?? '{}') as T;
    } catch (e) {
      lastErr = e; // malformed JSON or a transient error: retry once
    }
  }
  throw lastErr;
}

export async function genText(model: string, system: string, turns: ChatTurn[], maxOutputTokens = 1200): Promise<string> {
  const c = getClient();
  if (!c) throw new Error('LLM not configured');
  const res = await c.models.generateContent({
    model,
    contents: toContents(turns),
  });
  return (res.text ?? '').trim();
}

export interface ItemForLlm {
  sku: string;
  description: string;
  needsHs: boolean;
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
          isDangerous: { type: 'boolean' },
          category: { type: 'string', description: 'e.g. Lithium battery, Aerosol, Flammable liquid; empty if safe' },
          reason: { type: 'string', description: 'One short sentence' },
          hsSuggestion: { type: 'string', description: '6 digits, only when needsHs is true, else empty' },
        },
        required: ['sku', 'isDangerous'],
      },
    },
  },
  required: ['items'],
};

/**
 * One batched call to the fast model: dangerous-goods backstop for every item, plus HS code
 * suggestions for items that have none. Never throws; returns available:false on any failure.
 * The result only ADDS findings; rule pass/fail is still decided by deterministic code.
 */
export async function reviewItems(items: ItemForLlm[]): Promise<{
  available: boolean;
  dangerous: Record<string, LlmDangerousHit>;
  hs: Record<string, HsSuggestion>;
}> {
  const empty = { available: false, dangerous: {}, hs: {} };
  if (!llmConfigured()) return empty;
  if (!items.length) return { ...empty, available: true };
  try {
    const out = await genJson<{ items?: { sku: string; isDangerous: boolean; category?: string; reason?: string; hsSuggestion?: string }[] }>(
      FAST_MODEL,
      'You help a UK freight forwarder pre-check shipments. For each item, decide whether it is dangerous goods for road freight: lithium or other batteries (including rechargeable devices that contain them), aerosols, or flammable liquids. Be accurate in both directions: flag "rechargeable desk fan", but do NOT flag "lithium-free" or "battery not included" products. If needsHs is true, also suggest the most likely 6-digit HS code from the description. Return every item, using the sku exactly as given.',
      [{ role: 'user', content: JSON.stringify(items.slice(0, 300)) }],
      REVIEW_SCHEMA,
      8000,
    );
    const dangerous: Record<string, LlmDangerousHit> = {};
    const hs: Record<string, HsSuggestion> = {};
    for (const r of out.items ?? []) {
      if (!r?.sku) continue;
      dangerous[r.sku] = { isDangerous: !!r.isDangerous, category: r.category || undefined, reason: r.reason || undefined };
      const code = r.hsSuggestion?.replace(/\D/g, '');
      if (code && code.length >= 6) hs[r.sku] = { code: code.slice(0, 6), note: 'AI suggestion from the description' };
    }
    return { available: true, dangerous, hs };
  } catch (e) {
    console.error('LLM review failed', e instanceof Error ? e.message : e);
    return empty;
  }
}
