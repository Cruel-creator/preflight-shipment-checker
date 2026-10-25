import Anthropic from '@anthropic-ai/sdk';
import type { HsSuggestion, LlmDangerousHit } from '@/lib/types';

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-5-5';

export const llmConfigured = () => !!process.env.ANTHROPIC_API_KEY;
let client: Anthropic | null = null;
export function getClient(): Anthropic | null {
  if (!llmConfigured()) return null;
  return (client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 }));
}

export interface ItemForLlm {
  sku: string;
  description: string;
  needsHs: boolean;
}

/**
 * One batched call to the fast model: dangerous-goods backstop for every item, plus HS code
 * suggestions for items that have none. Never throws — returns available:false on any failure.
 * The result only ADDS findings; rule pass/fail is still decided by deterministic code.
 */
export async function reviewItems(items: ItemForLlm[]): Promise<{
  available: boolean;
  dangerous: Record<string, LlmDangerousHit>;
  hs: Record<string, HsSuggestion>;
}> {
  const c = getClient();
  const empty = { available: false, dangerous: {}, hs: {} };
  if (!c) return empty;
  if (!items.length) return { ...empty, available: true };
  const list = items.slice(0, 300);
  try {
    const res = await c.messages.create({
      model: FAST_MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' },
      system:
        'You help a UK freight forwarder pre-check shipments. For each item, decide whether it is dangerous goods for road freight: lithium or other batteries (including rechargeable devices that contain them), aerosols, or flammable liquids. Be accurate in both directions: flag "rechargeable desk fan", but do NOT flag "lithium-free" or "battery not included" products. If needsHs is true, also suggest the most likely 6-digit HS code from the description. You MUST answer by calling the report_items tool exactly once, covering every item.',
      tools: [
        {
          name: 'report_items',
          description: 'Report the review of every item.',
          input_schema: {
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
          },
        },
      ],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: JSON.stringify(list) }],
    });
    const block = res.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') return empty;
    const input = block.input as { items?: { sku: string; isDangerous: boolean; category?: string; reason?: string; hsSuggestion?: string }[] };
    const dangerous: Record<string, LlmDangerousHit> = {};
    const hs: Record<string, HsSuggestion> = {};
    for (const r of input.items ?? []) {
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
