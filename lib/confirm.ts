import { longDate, num } from '@/lib/format';
import type { Booking, CheckResult, Confirmation } from '@/lib/types';

export function buildConfirmation(b: Booking, r: CheckResult): Confirmation {
  const rec = r.recommendation;
  const c = rec.recommended;
  const blocked = r.status === 'Blocked';
  const route = `${b.originCity ?? '?'}, ${b.originCountry} → ${b.destinationCity ?? '?'}, ${b.destinationCountry ?? '?'}`;
  const statusMessage = {
    Blocked: `This shipment must not go yet: ${r.redCount} Red issue${r.redCount === 1 ? '' : 's'} need fixing${r.amberCount ? ` (plus ${r.amberCount} Amber warning${r.amberCount === 1 ? '' : 's'})` : ''}.`,
    Warnings: `This shipment can go, but ${r.amberCount} Amber warning${r.amberCount === 1 ? ' is' : 's are'} risky and should be fixed or checked first.`,
    Ready: 'All checks passed. This shipment is ready to ship.',
  }[r.status];

  const steps: Confirmation['nextSteps'] = [];
  if (r.redCount + r.amberCount > 0) {
    steps.push({ text: `Fix the ${r.redCount ? `${r.redCount} Red` : ''}${r.redCount && r.amberCount ? ' and ' : ''}${r.amberCount ? `${r.amberCount} Amber` : ''} issue${r.redCount + r.amberCount === 1 ? '' : 's'} listed above${blocked ? ' — the shipment cannot go until the Red ones are cleared' : ''}.` });
  }
  if (b.cartons) {
    steps.push({ text: `Label every carton "1 of ${num(b.cartons)}", "2 of ${num(b.cartons)}" … so the warehouse can count them against the booking.` });
  }
  if (b.destinationType === 'Warehouse' && b.appointmentBooked !== true) {
    steps.push({ text: `Book a delivery appointment with the receiving warehouse${c?.estimatedDelivery ? ` before ${longDate(c.estimatedDelivery)}` : ''}.` });
  }
  steps.push({ text: 'Complete the commercial invoice — the draft below pre-fills what we know and highlights what you still need to add.' });
  steps.push({ text: 'Prepare UK export and EU import customs paperwork (advisory — outside the scored rulebook): export declaration, EORI numbers, and import declaration for the destination country.', advisory: true });
  steps.push({ text: `The carrier collects on ${b.readyDate ? longDate(b.readyDate) : 'the ready date'}${c ? ` and aims to deliver by ${c.estimatedDelivery ? longDate(c.estimatedDelivery) : `${c.transitDays} days later`}` : ''}.` });

  return {
    route,
    carrierLine: c ? `${c.carrier} — ${c.service}` : null,
    pallets: b.pallets, cartons: b.cartons, grossWeightKg: b.grossWeightKg,
    totalCost: c?.totalCost ?? null,
    collectionDate: b.readyDate,
    estimatedDelivery: c?.estimatedDelivery ?? null,
    status: r.status, statusLabel: r.statusLabel, statusMessage,
    recommendationLabel: blocked ? 'Recommended once the issues above are fixed' : 'Recommended carrier',
    nextSteps: steps,
  };
}
