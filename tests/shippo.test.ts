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
