import { describe, expect, it } from 'vitest';
import { rank, validateInput, type LiveRate } from '@/lib/shippo';

const r = (id: string, amount: number, days: number | null, currency = 'USD'): LiveRate => ({ id, carrier: id, service: 'S', amount, currency, days, terms: '' });
const rates = [r('A', 10, 5), r('B', 14, 3), r('C', 30, 1)];

describe('shippo rank', () => {
  it('Cheapest / Fastest / Balanced', () => {
    expect(rank(rates, 'Cheapest').recommended?.id).toBe('A');
    expect(rank(rates, 'Fastest').recommended?.id).toBe('C');
    expect(rank(rates, 'Balanced').recommended?.id).toBe('B');
  });
  it('falls back to cheapest when no timings', () => {
    const x = rank([r('A', 10, null), r('B', 5, null)], 'Fastest');
    expect(x.recommended?.id).toBe('B');
    expect(x.notes.join(' ')).toContain('no delivery estimates');
  });
  it('does not mix currencies', () => {
    const x = rank([r('A', 10, 2), r('B', 1, 2, 'GBP'), r('C', 12, 2)], 'Cheapest');
    expect(x.recommended?.id).toBe('A');
    expect(x.notes.join(' ')).toContain('other currencies');
  });
  it('handles no rates', () => expect(rank([], 'Cheapest').recommended).toBeNull());
});

describe('validateInput', () => {
  const a = { street1: '1 Rd', city: 'X', zip: '1', country: 'GB' };
  const p = { lengthCm: 1, widthCm: 1, heightCm: 1, weightKg: 1 };
  it('accepts valid input', () => expect(validateInput({ from: a, to: { ...a, country: 'de' }, parcel: p })).toBeNull());
  it('needs a state for US', () => expect(validateInput({ from: { ...a, country: 'US' }, to: a, parcel: p })).toContain('state'));
  it('rejects pallets-sized parcels and bad country', () => {
    expect(validateInput({ from: a, to: a, parcel: { ...p, weightKg: 300 } })).toContain('too big');
    expect(validateInput({ from: { ...a, country: 'Germany' }, to: a, parcel: p })).toContain('2-letter');
  });
});

import { checkShipment, needsCustoms } from '@/lib/shippoRules';
import { profileFor } from '@/lib/countries';

const addr = (country: string) => ({ street1: '1 Rd', city: 'X', zip: '1', country });
const parcel = { lengthCm: 30, widthCm: 20, heightCm: 10, weightKg: 2 };
const ids = (s: Parameters<typeof checkShipment>[0]) => checkShipment(s).issues.filter((i) => i.severity !== 'Info').map((i) => i.ruleId);

describe('country of dispatch', () => {
  it('currency follows the dispatch country', () => {
    expect(profileFor('GB')?.currency).toBe('GBP');
    expect(profileFor('de')?.currency).toBe('EUR');
    expect(profileFor('US')?.currency).toBe('USD');
  });
  it('customs only across customs borders', () => {
    expect(needsCustoms('GB', 'DE')).toBe(true);
    expect(needsCustoms('DE', 'FR')).toBe(false);
    expect(needsCustoms('US', 'US')).toBe(false);
    expect(needsCustoms('DE', 'US')).toBe(true);
  });
});
describe('checkShipment', () => {
  const full = { description: 'Ceramic mugs', valueAmount: 60, hsCode: '691200', originCountry: 'GB' };
  it('clean international shipment', () => expect(ids({ from: addr('GB'), to: addr('DE'), parcel, goods: full })).toEqual([]));
  it('missing customs data', () => {
    expect(ids({ from: addr('GB'), to: addr('US'), parcel })).toEqual(['P-02', 'P-03', 'P-04']);
  });
  it('domestic and intra-EU need none', () => {
    expect(ids({ from: addr('DE'), to: addr('FR'), parcel })).toEqual([]);
    expect(ids({ from: addr('US'), to: addr('US'), parcel })).toEqual([]);
  });
  it('flags dangerous goods', () => expect(ids({ from: addr('GB'), to: addr('DE'), parcel, goods: { ...full, description: 'Lithium power bank' } })).toContain('P-01'));
  it('US export filing threshold', () => expect(ids({ from: addr('US'), to: addr('GB'), parcel, goods: { ...full, valueAmount: 3000 } })).toContain('P-05'));
  it('volumetric weight note', () => {
    const r = checkShipment({ from: addr('GB'), to: addr('DE'), parcel: { lengthCm: 60, widthCm: 50, heightCm: 40, weightKg: 2 }, goods: full });
    expect(r.issues.some((i) => i.ruleId === 'P-07')).toBe(true);
  });
});
describe('currency conversion ranking', () => {
  it('ranks on prices converted to the dispatch currency', () => {
    const x = rank([{ ...r('A', 10, 2, 'USD'), amountDispatch: 7.5 }, { ...r('B', 8, 2, 'GBP'), amountDispatch: 8 }], 'Cheapest', 'GBP');
    expect(x.recommended?.id).toBe('A');
    expect(x.reason).toContain('GBP');
  });
});
