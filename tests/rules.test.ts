import { describe, expect, it } from 'vitest';
import { runChecks } from '@/lib/rules';
import { scanDescription } from '@/lib/rules/dangerous';
import { bk001, mug, TODAY } from './fixtures';
import type { Booking } from '@/lib/types';

const run = (b: Booking, extra = {}) => runChecks(b, { today: TODAY, ...extra });
const ids = (b: Booking, extra = {}) => run(b, extra).issues.filter((i) => i.severity !== 'Info').map((i) => i.ruleId);
const hasPass = (b: Booking, id: string) => run(b).passed.some((p) => p.ruleId === id);

describe('BK-001 template example', () => {
  it('passes every rule', () => {
    const r = run(bk001());
    expect(r.issues.filter((i) => i.severity !== 'Info')).toEqual([]);
    expect(r.status).toBe('Ready');
    for (let n = 1; n <= 10; n++) expect(hasPass(bk001(), `R-${String(n).padStart(2, '0')}`)).toBe(true);
    expect(r.recommendation.recommended?.carrier).toBe('Carrier A');
  });
});

describe('R-01 HS code', () => {
  it('passes with 6+ digits (dots/spaces stripped)', () => {
    expect(ids(bk001({ items: [mug({ hsCode: '6912.00' })] }))).toEqual([]);
    expect(ids(bk001({ items: [mug({ hsCode: '6912 00 10' })] }))).toEqual([]);
  });
  it('flags missing as Red', () => {
    const r = run(bk001({ items: [mug({ hsCode: null })] }));
    expect(r.issues[0]).toMatchObject({ ruleId: 'R-01', severity: 'Red' });
  });
  it('flags short code and suggests zero-padding for exactly 5 digits', () => {
    const r = run(bk001({ items: [mug({ hsCode: '90111' })] }));
    const i = r.issues.find((x) => x.ruleId === 'R-01')!;
    expect(i.whatsWrong).toContain('leading zero');
    expect(i.whatsWrong).toContain('090111');
    const r4 = run(bk001({ items: [mug({ hsCode: '9011' })] })).issues.find((x) => x.ruleId === 'R-01')!;
    expect(r4.whatsWrong).not.toContain('leading zero');
  });
  it('includes an AI suggestion, labelled', () => {
    const r = run(bk001({ items: [mug({ hsCode: null })] }), { hsSuggestions: { 'MUG-01': { code: '691200' } } });
    expect(r.issues[0].howToFix.join(' ')).toContain('Suggested — please confirm on the UK Trade Tariff tool');
  });
});

describe('R-02 declared value', () => {
  it('passes within 1%', () => expect(ids(bk001({ declaredValue: 5430 }))).toEqual([]));
  it('fails beyond 1%', () => {
    const r = run(bk001({ declaredValue: 5000 }));
    const i = r.issues.find((x) => x.ruleId === 'R-02')!;
    expect(i.severity).toBe('Red');
    expect(i.whatsWrong).toContain('£5,000');
    expect(i.whatsWrong).toContain('£5,400');
    expect(i.howToFix[0]).toContain('£5,400');
  });
  it('1% boundary is allowed', () => expect(ids(bk001({ declaredValue: 5454 }))).toEqual([]));
});

describe('R-03 units per carton', () => {
  it('passes when equal', () => expect(hasPass(bk001(), 'R-03')).toBe(true));
  it('fails and offers both fixes', () => {
    const r = run(bk001({ items: [mug({ cartons: 80 })], cartons: 80 }));
    const i = r.issues.find((x) => x.ruleId === 'R-03')!;
    expect(i.whatsWrong).toContain('12 units per carton × 80 cartons = 960');
    expect(i.howToFix).toHaveLength(2);
    expect(i.howToFix[0]).toContain('= 90');
    expect(i.howToFix[1]).toContain('960');
    expect(i.whyItMatters).toContain('missing');
  });
  it('rounds up part-filled cartons', () => {
    const i = run(bk001({ items: [mug({ quantity: 1085, cartons: 90 })] })).issues.find((x) => x.ruleId === 'R-03')!;
    expect(i.howToFix[0]).toContain('91');
  });
});

describe('R-04 carton total', () => {
  it('passes when equal', () => expect(hasPass(bk001(), 'R-04')).toBe(true));
  it('fails when booking total differs', () => {
    const i = run(bk001({ cartons: 100 })).issues.find((x) => x.ruleId === 'R-04')!;
    expect(i.severity).toBe('Red');
    expect(i.whatsWrong).toContain('100');
    expect(i.whatsWrong).toContain('90');
  });
  it('names an R-03 failure as the root cause', () => {
    const b = bk001({
      cartons: 120,
      items: [mug({ sku: 'A', cartons: 90 }), mug({ sku: 'B', quantity: 360, unitsPerCarton: 12, cartons: 20, unitPrice: 5 })],
      declaredValue: 7200,
    });
    const r = run(b);
    expect(r.issues.some((x) => x.ruleId === 'R-03' && x.itemSku === 'B')).toBe(true);
    const r04 = r.issues.find((x) => x.ruleId === 'R-04')!;
    expect(r04.whatsWrong).toContain('Likely root cause');
    expect(r04.whatsWrong).toContain('B');
  });
});

describe('R-05 weight vs carrier', () => {
  it('is Info (not Red) when the preferred carrier is excluded but another works', () => {
    const r = run(bk001({ priority: 'Fastest', pallets: 2, grossWeightKg: 900, appointmentBooked: true }));
    expect(r.recommendation.recommended?.carrier).toBe('Carrier B');
    const i = r.issues.find((x) => x.ruleId === 'R-05')!;
    expect(i.severity).toBe('Info');
    expect(i.whatsWrong).toContain('450.0 kg');
    expect(r.issues.filter((x) => x.severity === 'Red').some((x) => x.ruleId === 'R-05')).toBe(false);
  });
  it('is Red when no carrier can take it, with pallet maths', () => {
    const r = run(bk001({ pallets: 1, grossWeightKg: 800 }));
    const i = r.issues.find((x) => x.ruleId === 'R-05')!;
    expect(i.severity).toBe('Red');
    expect(i.whatsWrong).toContain('800.0 kg');
    expect(i.howToFix[0]).toContain('at least 2 pallets');
    expect(i.howToFix.join(' ')).toContain('Carrier A');
    expect(i.howToFix.join(' ')).toContain('Carrier C');
    expect(r.recommendation.recommended).toBeNull();
  });
  it('exactly 750 per pallet is fine', () => {
    expect(run(bk001({ pallets: 2, grossWeightKg: 1500, priority: 'Most reliable' })).issues.some((x) => x.ruleId === 'R-05' && x.severity === 'Red')).toBe(false);
  });
  it('guards zero pallets', () => {
    const r = run(bk001({ pallets: 0 }));
    expect(r.issues.some((x) => x.ruleId === 'DATA-07')).toBe(true);
    expect(r.recommendation.weightPerPallet).toBeNull();
  });
});

describe('R-06 dangerous goods', () => {
  const dg = (d: string) => ids(bk001({ items: [mug({ description: d })] })).includes('R-06');
  it('flags keywords', () => {
    for (const d of ['Lithium power bank', 'Li-ion cells', 'Aerosol deodorant', 'Lighter fluid 200ml', 'Nail polish remover (acetone)', 'Rechargeable battery pack', 'Perfume 50ml']) expect(dg(d)).toBe(true);
  });
  it('does not flag clean descriptions or negations', () => {
    for (const d of ['Ceramic coffee mug', 'Lithium-free cleanser', 'Toy car, battery not included', 'Non-flammable fabric', 'Spirit level']) expect(dg(d)).toBe(false);
  });
  it('flags HS 8507', () => expect(ids(bk001({ items: [mug({ hsCode: '850760' })] }))).toContain('R-06'));
  it('uses LLM backstop', () => {
    const b = bk001({ items: [mug({ description: 'USB desk fan' })] });
    expect(ids(b)).not.toContain('R-06');
    expect(ids(b, { llmDangerous: { 'MUG-01': { isDangerous: true, category: 'Lithium battery', reason: 'portable desk fans often contain Li-ion cells' } } })).toContain('R-06');
  });
  it('perfume reads as a "check"', () => expect(scanDescription('Eau de perfume')?.reason).toContain('Check'));
  it('catches by keyword what used to need the AI', () => {
    for (const d of ['Nail varnish 10 ml, red', 'Bluetooth speaker, portable', 'Portable charger 20000mAh', 'Deodorant spray 150 ml', 'London dry gin 70cl, 40% ABV', 'Drone with camera', 'Rechargeable desk fan']) expect(scanDescription(d), d).not.toBeNull();
  });
  it('does not flag accessories, negations or weak drinks', () => {
    for (const d of ['Mobile phone case, silicone', 'Laptop sleeve, neoprene', 'Battery-free wall clock', 'Lager 4.5% ABV', 'Wooden balance bike', 'Ginger biscuits']) expect(scanDescription(d), d).toBeNull();
  });
});

describe('R-07 gross weight', () => {
  it('passes when gross >= net', () => expect(hasPass(bk001(), 'R-07')).toBe(true));
  it('Amber when gross < net', () => {
    const i = run(bk001({ grossWeightKg: 500 })).issues.find((x) => x.ruleId === 'R-07')!;
    expect(i.severity).toBe('Amber');
    expect(i.whatsWrong).toContain('540');
    expect(i.howToFix[0]).toContain('540');
  });
});

describe('R-08 appointment', () => {
  it('Amber for warehouse without appointment', () => {
    expect(run(bk001({ appointmentBooked: false })).issues.find((x) => x.ruleId === 'R-08')?.severity).toBe('Amber');
  });
  it('no issue for business address', () => expect(ids(bk001({ destinationType: 'Business address', appointmentBooked: false }))).toEqual([]));
  it('no issue when booked', () => expect(hasPass(bk001(), 'R-08')).toBe(true));
});

describe('R-09 country of origin', () => {
  it('Amber per blank item', () => {
    const r = run(bk001({ items: [mug({ countryOfOrigin: null }), mug({ sku: 'B', countryOfOrigin: '' })], cartons: 180, declaredValue: 10800 }));
    expect(r.issues.filter((x) => x.ruleId === 'R-09')).toHaveLength(2);
  });
  it('passes when given', () => expect(hasPass(bk001(), 'R-09')).toBe(true));
});

describe('R-10 ready date', () => {
  it('today is allowed', () => expect(ids(bk001({ readyDate: TODAY }))).toEqual([]));
  it('yesterday is Amber', () => expect(run(bk001({ readyDate: '2026-10-24' })).issues.find((x) => x.ruleId === 'R-10')?.severity).toBe('Amber'));
  it('future passes', () => expect(hasPass(bk001(), 'R-10')).toBe(true));
});

describe('DATA checks', () => {
  it('Lyon in Germany', () => {
    const i = run(bk001({ destinationCity: 'Lyon' })).issues.find((x) => x.ruleId === 'DATA-01')!;
    expect(i.severity).toBe('Red');
    expect(i.whatsWrong).toContain('France');
  });
  it('no items', () => expect(ids(bk001({ items: [] }))).toContain('DATA-03'));
  it('unsupported city is not called a country mismatch', () => {
    const i = run(bk001({ destinationCity: 'Munich' })).issues.find((x) => x.ruleId === 'DATA-02')!;
    expect(i.title).toBe('Unsupported destination city');
    expect(i.howToFix[0]).toContain('Frankfurt');
    expect(ids(bk001({ destinationCity: 'Munich' }))).not.toContain('DATA-01');
  });
  it('an AI dangerous-goods guess does not override a stated low alcohol strength', () => {
    const wine = { sku: 'WIN-75', description: 'Red wine 75cl, 13.5% vol', hsCode: '220421', quantity: 120, unitPrice: 8, unitsPerCarton: 6, cartons: 20, unitWeightKg: 1.3, countryOfOrigin: 'Germany' };
    const llmDangerous = { 'WIN-75': { isDangerous: true, category: 'Flammable liquid', reason: 'Contains alcohol' } };
    const b = bk001({ items: [wine], cartons: 20, declaredValue: 960, grossWeightKg: 250 });
    expect(runChecks(b, { today: TODAY, llmDangerous }).issues.map((x) => x.ruleId)).not.toContain('R-06');
    const whisky = { ...wine, sku: 'WSK-70', description: 'Single malt whisky 70cl, 40% ABV' };
    expect(runChecks(bk001({ items: [whisky], cartons: 20, declaredValue: 960, grossWeightKg: 250 }), { today: TODAY }).issues.map((x) => x.ruleId)).toContain('R-06');
  });
  it('a typed priority outside the four is flagged, not a crash', () => {
    const c = run(bk001({ priority: 'ASAP' as never }));
    expect(c.issues.map((x) => x.ruleId)).toContain('DATA-02');
    expect(c.status).toBe('Blocked');
    expect(c.recommendation.recommended).toBeNull();
    expect(c.recommendation.reason).toContain('ASAP');
  });
});

describe('overall status', () => {
  it('Blocked > Warnings > Ready', () => {
    expect(run(bk001({ declaredValue: 1 })).status).toBe('Blocked');
    expect(run(bk001({ appointmentBooked: false })).status).toBe('Warnings');
    expect(run(bk001()).status).toBe('Ready');
  });
});
