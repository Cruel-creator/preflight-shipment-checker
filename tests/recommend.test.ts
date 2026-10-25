import { describe, expect, it } from 'vitest';
import { recommendCarrier } from '@/lib/recommend';
import { londonToday, addDays } from '@/lib/dates';
import { buildConfirmation } from '@/lib/confirm';
import { runChecks } from '@/lib/rules';
import { bk001, TODAY } from './fixtures';

const rec = (o = {}) => recommendCarrier(bk001(o));

describe('recommendCarrier', () => {
  it('Cheapest picks A, with cost and ETA', () => {
    const r = rec();
    expect(r.recommended?.carrier).toBe('Carrier A');
    expect(r.recommended?.totalCost).toBe(540);
    expect(r.recommended?.estimatedDelivery).toBe('2026-11-10');
  });
  it('Fastest picks C when feasible', () => expect(rec({ priority: 'Fastest' }).recommended?.carrier).toBe('Carrier C'));
  it('Most reliable picks C', () => expect(rec({ priority: 'Most reliable' }).recommended?.carrier).toBe('Carrier C'));
  it('Balanced (40/30/30) picks B', () => {
    const r = rec({ priority: 'Balanced' });
    expect(r.recommended?.carrier).toBe('Carrier B');
    const byName = Object.fromEntries(r.carriers.map((c) => [c.carrier, c.score!]));
    expect(byName['Carrier B']).toBeCloseTo(0.65, 2);
    expect(byName['Carrier C']).toBeCloseTo(0.6, 2);
    expect(byName['Carrier A']).toBeCloseTo(0.4, 2);
  });
  it('450 kg/pallet + Fastest excludes C and picks B', () => {
    const r = rec({ priority: 'Fastest', pallets: 2, grossWeightKg: 900 });
    expect(r.recommended?.carrier).toBe('Carrier B');
    expect(r.excludedPreferred?.carrier).toBe('Carrier C');
    expect(r.carriers.find((c) => c.carrier === 'Carrier C')?.infeasibleReason).toContain('450');
  });
  it('only one feasible carrier wins Balanced', () => {
    expect(rec({ priority: 'Balanced', pallets: 1, grossWeightKg: 700 }).recommended?.carrier).toBe('Carrier B');
  });
  it('none feasible => null', () => expect(rec({ pallets: 1, grossWeightKg: 800 }).recommended).toBeNull());
  it('uses destination country rate card', () => {
    expect(rec({ destinationCountry: 'Netherlands', destinationCity: 'Amsterdam' }).recommended?.totalCost).toBe(480);
  });
  it('Cheapest + heavy: suggests extra pallets only when worth it', () => {
    const r = rec({ pallets: 4, grossWeightKg: 2400 }); // 600 kg/pallet -> A out
    expect(r.recommended?.carrier).toBe('Carrier B');
    expect(r.notes.join(' ')).toContain('5 pallets');
    expect(r.notes.join(' ')).toContain('Carrier A');
  });
  it('reason mentions the trade-off', () => {
    expect(rec({ priority: 'Balanced' }).reason).toMatch(/costs £\d+ (more|less)/);
  });
});

describe('dates', () => {
  it('addDays crosses month ends', () => expect(addDays('2026-10-30', 5)).toBe('2026-11-04'));
  it('londonToday is ISO', () => expect(londonToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  it('londonToday handles BST/GMT midnight', () => {
    expect(londonToday(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02');
    expect(londonToday(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-01');
  });
});

describe('buildConfirmation', () => {
  it('ready booking', () => {
    const b = bk001();
    const c = buildConfirmation(b, runChecks(b, { today: TODAY }));
    expect(c.statusLabel).toBe('Ready to ship');
    expect(c.totalCost).toBe(540);
    expect(c.nextSteps.some((s) => s.text.includes('1 of 90'))).toBe(true);
  });
  it('blocked booking still has a recommendation, labelled', () => {
    const b = bk001({ declaredValue: 1 });
    const c = buildConfirmation(b, runChecks(b, { today: TODAY }));
    expect(c.recommendationLabel).toContain('once the issues');
    expect(c.carrierLine).toContain('Carrier A');
  });
});
