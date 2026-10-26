import { describe, expect, it } from 'vitest';
import { applyUpdate, diffSnapshots, emptyBooking, missingFields, snapshot } from '@/lib/chat';
import { analyseBooking } from '@/lib/analyze';
import { TODAY } from './fixtures';

const first = applyUpdate(emptyBooking(), {
  sellerName: 'Northfield Goods', originCity: 'manchester', destinationCity: 'Frankfurt', destinationType: 'warehouse',
  priority: 'Cheapest', pallets: 3, readyDate: '2026-11-05',
  itemOps: [{ op: 'add', description: 'mugs', quantity: 1080, unitPrice: 5 }],
});

describe('applyUpdate', () => {
  it('normalises values and infers country from city', () => {
    expect(first.draft).toMatchObject({ originCity: 'Manchester', destinationCity: 'Frankfurt', destinationCountry: 'Germany', destinationType: 'Warehouse' });
    expect(first.draft.items[0]).toMatchObject({ sku: 'ITEM-1', quantity: 1080, unitPrice: 5 });
  });
  it('derives declared value from items and flags it', () => {
    expect(first.draft.declaredValue).toBe(5400);
    expect(first.draft.derived?.declaredValue).toBe(true);
  });
  it('rejects unsupported cities with options', () => {
    const r = applyUpdate(emptyBooking(), { destinationCity: 'Munich' });
    expect(r.draft.destinationCity).toBeNull();
    expect(r.rejected[0].options.join(' ')).toContain('Frankfurt');
    const g = applyUpdate({ ...emptyBooking(), destinationCountry: 'Germany' }, { destinationCity: 'Munich' });
    expect(g.rejected[0].options).toEqual(['Berlin', 'Frankfurt', 'Hamburg']);
  });
  it('logs changes old → new', () => {
    const r = applyUpdate(first.draft, { pallets: 4 });
    expect(r.changes).toEqual([{ field: 'pallets', label: 'Pallets', from: '3', to: '4' }]);
  });
  it('stating a total clears the derived flag', () => {
    const r = applyUpdate(first.draft, { declaredValue: 5400 });
    expect(r.draft.derived?.declaredValue).toBe(false);
  });
  it('recomputes derived totals when items change', () => {
    const r = applyUpdate(first.draft, { itemOps: [{ op: 'update', quantity: 1200 }] });
    expect(r.draft.declaredValue).toBe(6000);
    expect(r.changes.some((c) => c.field === 'declaredValue')).toBe(true);
  });
  it('rejects invalid numbers and dates', () => {
    const r = applyUpdate(emptyBooking(), { pallets: -2, readyDate: '2026-02-31' });
    expect(r.rejected.map((x) => x.field).sort()).toEqual(['pallets', 'readyDate']);
  });
});

describe('extraction clean-up', () => {
  it('strips model junk and maps loose country names', () => {
    const r = applyUpdate(first.draft, { itemOps: [{ op: 'add', description: 'power banks', countryOfOrigin: 'ChinaControl Token Removed', hsCode: ' 850760 ' }] });
    expect(r.draft.items[1]).toMatchObject({ countryOfOrigin: 'China', hsCode: '850760' });
    const uk = applyUpdate(first.draft, { itemOps: [{ op: 'update', countryOfOrigin: 'UK' }] });
    expect(uk.draft.items[0].countryOfOrigin).toBe('United Kingdom');
  });
  it('works out item cartons from quantity ÷ units per carton, and keeps them in step', () => {
    const r = applyUpdate(first.draft, { itemOps: [{ op: 'update', unitsPerCarton: 12 }] });
    expect(r.draft.items[0]).toMatchObject({ cartons: 90, cartonsDerived: true });
    expect(r.draft.cartons).toBe(90);
    const more = applyUpdate(r.draft, { itemOps: [{ op: 'update', quantity: 1200 }] });
    expect(more.draft.items[0].cartons).toBe(100);
    const stated = applyUpdate(r.draft, { itemOps: [{ op: 'update', cartons: 80 }] });
    expect(stated.draft.items[0]).toMatchObject({ cartons: 80, cartonsDerived: false });
  });
  it('a confirmed total that matched the items follows them when a line is added', () => {
    const confirmed = applyUpdate(first.draft, { confirmDerived: true }).draft;
    const r = applyUpdate(confirmed, { itemOps: [{ op: 'add', description: 'bowls', quantity: 100, unitPrice: 3 }] });
    expect(r.draft.declaredValue).toBe(5700);
    expect(r.draft.derived?.declaredValue).toBe(true);
    const stated = applyUpdate({ ...confirmed, declaredValue: 3000 }, { itemOps: [{ op: 'add', description: 'bowls', quantity: 100, unitPrice: 3 }] });
    expect(stated.draft.declaredValue).toBe(3000);
  });
});

describe('missingFields', () => {
  it('asks for everything not yet given, appointment only for warehouses', () => {
    const m = missingFields(first.draft).map((x) => x.field);
    expect(m).toContain('appointmentBooked');
    expect(m).toContain('grossWeightKg');
    expect(m).toContain('item:ITEM-1');
    expect(m).not.toContain('pallets');
    expect(missingFields({ ...first.draft, destinationType: 'Business address' }).map((x) => x.field)).not.toContain('appointmentBooked');
  });
  it('is empty for a complete booking', () => {
    const done = applyUpdate(first.draft, { appointmentBooked: true, grossWeightKg: 620, itemOps: [{ op: 'update', unitsPerCarton: 12, cartons: 90, unitWeightKg: 0.5 }] });
    expect(missingFields(done.draft)).toEqual([]);
    expect(done.draft.cartons).toBe(90);
  });
});

describe('mid-conversation change: add a pallet', () => {
  it('updates weight per pallet, cost and the diff', () => {
    const done = applyUpdate(first.draft, { appointmentBooked: true, grossWeightKg: 620, itemOps: [{ op: 'update', unitsPerCarton: 12, cartons: 90, unitWeightKg: 0.5, countryOfOrigin: 'United Kingdom', hsCode: '691200' }] }).draft;
    const a = analyseBooking(done, undefined, TODAY);
    expect(a.check.status).toBe('Ready');
    const bumped = applyUpdate(done, { pallets: 4 });
    const b = analyseBooking(bumped.draft, undefined, TODAY);
    const d = diffSnapshots(snapshot(a), snapshot(b), bumped.changes);
    expect(d.weightPerPallet[0]).toBeCloseTo(206.7, 1);
    expect(d.weightPerPallet[1]).toBeCloseTo(155, 1);
    expect(d.cost).toEqual([540, 720]);
    expect(d.recommendationNote).toContain('unchanged');
  });
});
