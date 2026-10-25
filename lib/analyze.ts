import { buildConfirmation } from '@/lib/confirm';
import { reviewItems } from '@/lib/llm';
import { runChecks } from '@/lib/rules';
import { londonToday } from '@/lib/dates';
import type { Booking, CheckResult, Confirmation, HsSuggestion, LlmDangerousHit } from '@/lib/types';

export interface BookingResult {
  booking: Booking;
  check: CheckResult;
  confirmation: Confirmation;
}

export function analyseBooking(
  b: Booking,
  llm?: { dangerous?: Record<string, LlmDangerousHit>; hs?: Record<string, HsSuggestion> },
  today = londonToday(),
): BookingResult {
  const check = runChecks(b, { today, llmDangerous: llm?.dangerous, hsSuggestions: llm?.hs });
  return { booking: b, check, confirmation: buildConfirmation(b, check) };
}

/** Analyse many bookings with ONE batched LLM call (keyed by bookingId::sku). */
export async function analyseMany(bookings: Booking[]) {
  const items = bookings.flatMap((b) =>
    b.items.map((i) => ({ sku: `${b.bookingId}::${i.sku}`, description: i.description, needsHs: !i.hsCode?.trim() })),
  );
  const review = await reviewItems(items);
  const today = londonToday();
  const results = bookings.map((b) => {
    const dangerous: Record<string, LlmDangerousHit> = {};
    const hs: Record<string, HsSuggestion> = {};
    for (const i of b.items) {
      const k = `${b.bookingId}::${i.sku}`;
      if (review.dangerous[k]) dangerous[i.sku] = review.dangerous[k];
      if (review.hs[k]) hs[i.sku] = review.hs[k];
    }
    return analyseBooking(b, { dangerous, hs }, today);
  });
  return { results, llmAvailable: review.available };
}
