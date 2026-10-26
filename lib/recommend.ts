import { BALANCED_WEIGHTS, CARRIERS, PRIORITIES } from '@/lib/data/reference';
import { addDays, isValidIso } from '@/lib/dates';
import { kg, kgPlain, money } from '@/lib/format';
import type { Booking, CarrierEvaluation, Priority, Recommendation } from '@/lib/types';

export function weightPerPallet(b: Pick<Booking, 'grossWeightKg' | 'pallets'>): number | null {
  if (b.grossWeightKg == null || b.pallets == null || b.pallets <= 0) return null;
  return b.grossWeightKg / b.pallets;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Rank carriers (best first) for a priority. Pure; works on any list. */
function rankBy(list: CarrierEvaluation[], priority: Priority): CarrierEvaluation[] {
  const cost = (c: CarrierEvaluation) => c.totalCost ?? c.pricePerPallet;
  const byCost = (a: CarrierEvaluation, b: CarrierEvaluation) => cost(a) - cost(b);
  const arr = [...list];
  switch (priority) {
    case 'Cheapest':
      return arr.sort(byCost);
    case 'Fastest':
      return arr.sort((a, b) => a.transitDays - b.transitDays || b.onTimePct - a.onTimePct || byCost(a, b));
    case 'Most reliable':
      return arr.sort((a, b) => b.onTimePct - a.onTimePct || a.transitDays - b.transitDays || byCost(a, b));
    case 'Balanced': {
      scoreBalanced(arr);
      return arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || byCost(a, b));
    }
  }
}

/** Min-max normalise each criterion across the given carriers (1 = best). */
function scoreBalanced(list: CarrierEvaluation[]) {
  const cost = (c: CarrierEvaluation) => c.totalCost ?? c.pricePerPallet;
  const norm = (v: number, min: number, max: number, lowerIsBetter: boolean) =>
    max === min ? 1 : lowerIsBetter ? (max - v) / (max - min) : (v - min) / (max - min);
  const costs = list.map(cost);
  const times = list.map((c) => c.transitDays);
  const rel = list.map((c) => c.onTimePct);
  for (const c of list) {
    const s = {
      cost: norm(cost(c), Math.min(...costs), Math.max(...costs), true),
      speed: norm(c.transitDays, Math.min(...times), Math.max(...times), true),
      reliability: norm(c.onTimePct, Math.min(...rel), Math.max(...rel), false),
    };
    c.scoreBreakdown = s;
    c.score =
      s.cost * BALANCED_WEIGHTS.cost + s.speed * BALANCED_WEIGHTS.speed + s.reliability * BALANCED_WEIGHTS.reliability;
  }
}

function tradeoffSentence(win: CarrierEvaluation, other: CarrierEvaluation, priority: Priority): string {
  const costDiff = (win.totalCost ?? 0) - (other.totalCost ?? 0);
  const dayDiff = other.transitDays - win.transitDays; // positive = winner faster
  const relDiff = win.onTimePct - other.onTimePct;
  const parts: string[] = [];
  const costPart =
    costDiff === 0 ? `costs the same as ${other.carrier}` : `costs ${money(Math.abs(costDiff))} ${costDiff > 0 ? 'more' : 'less'} than ${other.carrier}`;
  const timePart =
    dayDiff === 0
      ? 'takes the same time'
      : `arrives ${Math.abs(dayDiff)} day${Math.abs(dayDiff) === 1 ? '' : 's'} ${dayDiff > 0 ? 'sooner' : 'later'}`;
  const relPart =
    relDiff === 0
      ? `is equally reliable (${win.onTimePct}% on time)`
      : `is on time ${win.onTimePct}% of the time (${other.carrier}: ${other.onTimePct}%)`;
  parts.push(costPart, timePart);
  const head = `${win.carrier} ${parts.join(' but ')}`;
  void priority;
  return `${head}, and ${relPart}.`;
}

export function recommendCarrier(b: Booking): Recommendation {
  const assumptions = [
    'Estimated delivery = ready date + transit days, counted in calendar days (weekends and customs time are not modelled).',
    'Total cost = price per pallet × number of pallets, from the fixed rate card.',
  ];
  const wpp = weightPerPallet(b);
  const route = CARRIERS.filter((c) => c.destination === b.destinationCountry);
  const priority = b.priority;
  const pallets = b.pallets != null && b.pallets > 0 ? b.pallets : null;

  const carriers: CarrierEvaluation[] = route.map((c) => {
    const feasible = wpp == null ? true : wpp <= c.maxKgPerPallet + 1e-9;
    return {
      ...c,
      feasible,
      infeasibleReason: feasible
        ? undefined
        : `${c.carrier} caps pallets at ${c.maxKgPerPallet} kg; yours average ${kg(round1(wpp!))}.`,
      totalCost: pallets != null ? c.pricePerPallet * pallets : null,
      estimatedDelivery: b.readyDate && isValidIso(b.readyDate) ? addDays(b.readyDate, c.transitDays) : null,
    };
  });

  const empty: Recommendation = {
    priority, recommended: null, carriers, reason: '', notes: [], weightPerPallet: wpp, assumptions,
  };
  if (!route.length) {
    return { ...empty, reason: 'No destination country chosen yet, so no carrier can be recommended.' };
  }
  if (!priority) {
    return { ...empty, reason: 'No seller priority chosen yet, so no carrier can be recommended.' };
  }
  // A typed value outside the four (e.g. "ASAP") is flagged as DATA-02; ranking needs one of the four.
  if (!(PRIORITIES as readonly string[]).includes(priority)) {
    return { ...empty, reason: `Seller priority "${priority}" is not one of ${PRIORITIES.join(', ')}, so no carrier can be recommended.` };
  }

  const feasible = carriers.filter((c) => c.feasible);
  const notes: string[] = [];

  // Always compute Balanced scores on the feasible set so the "How we chose" panel is complete.
  // (Scores are only used for ranking when priority is Balanced.)
  const ranked = feasible.length ? rankBy(feasible, priority) : [];
  ranked.forEach((c, i) => (c.rank = i + 1));
  if (priority !== 'Balanced' && feasible.length) scoreBalanced(feasible);

  const winner = ranked[0] ?? null;

  // What would the priority have picked if weight didn't matter?
  const everyone = rankBy(carriers.map((c) => ({ ...c })), priority);
  const preferred = everyone[0];
  const excludedPreferred =
    winner && preferred && !preferred.feasible
      ? carriers.find((c) => c.carrier === preferred.carrier)
      : undefined;

  if (!winner) {
    return {
      ...empty,
      reason: `No carrier on this route can take pallets averaging ${kg(round1(wpp!))} (the highest limit is 750 kg).`,
      notes,
    };
  }

  let reason: string;
  const runnerUp = ranked[1];
  const priorityPhrase: Record<Priority, string> = {
    Cheapest: 'the lowest total cost',
    Fastest: 'the shortest transit time',
    'Most reliable': 'the best on-time rate',
    Balanced: 'the best overall balance of cost (40%), speed (30%) and reliability (30%)',
  };
  const lead = `${winner.carrier} (${winner.service}) gives ${priorityPhrase[priority]} among the carriers that can take your pallets`;
  if (feasible.length === 1) {
    reason = `${winner.carrier} (${winner.service}) is the only carrier that can take pallets of ${kg(round1(wpp ?? 0))}.`;
  } else if (runnerUp) {
    reason = `${lead}: ${money(winner.totalCost ?? 0)} total, ${winner.transitDays} days, ${winner.onTimePct}% on time. ${tradeoffSentence(winner, runnerUp, priority)}`;
  } else {
    reason = lead + '.';
  }

  if (excludedPreferred) {
    notes.push(
      `Your priority (${priority}) would normally pick ${excludedPreferred.carrier}, but ${excludedPreferred.infeasibleReason} ${winner.carrier} was chosen instead.`,
    );
  }

  // Extra pallets can unlock a cheaper/faster carrier — show when it is actually worth it.
  if (wpp != null && pallets != null) {
    for (const c of carriers.filter((x) => !x.feasible && x.maxKgPerPallet >= 400)) {
      const needed = Math.ceil(b.grossWeightKg! / c.maxKgPerPallet);
      if (needed <= pallets) continue;
      const cost = c.pricePerPallet * needed;
      const cmp = cost < (winner.totalCost ?? Infinity);
      if (priority === 'Cheapest' || c === excludedPreferred) {
        notes.push(
          `Splitting onto ${needed} pallets would let ${c.carrier} take it (${kg(round1(b.grossWeightKg! / needed))} per pallet) at ${money(cost)} total — ${
            cmp ? `${money((winner.totalCost ?? 0) - cost)} cheaper than ${winner.carrier} today` : `${money(cost - (winner.totalCost ?? 0))} more than ${winner.carrier} today, so it is not worth it`
          }.`,
        );
      }
    }
  }

  return { priority, recommended: winner, carriers, reason, excludedPreferred, notes, weightPerPallet: wpp, assumptions };
}
