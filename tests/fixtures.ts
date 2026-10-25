import type { Booking, Item } from '@/lib/types';

export const TODAY = '2026-10-25';

export const mug = (o: Partial<Item> = {}): Item => ({
  sku: 'MUG-01', description: 'Ceramic coffee mug, 350 ml', hsCode: '691200',
  quantity: 1080, unitPrice: 5, unitsPerCarton: 12, cartons: 90, unitWeightKg: 0.5,
  countryOfOrigin: 'United Kingdom', ...o,
});

/** The template's example booking BK-001 — must pass every rule. */
export const bk001 = (o: Partial<Booking> = {}): Booking => ({
  bookingId: 'BK-001', sellerName: 'Northfield Goods', originCity: 'Manchester', originCountry: 'United Kingdom',
  destinationCity: 'Frankfurt', destinationCountry: 'Germany', destinationType: 'Warehouse',
  readyDate: '2026-11-05', priority: 'Cheapest', pallets: 3, cartons: 90, declaredValue: 5400,
  currency: 'GBP', grossWeightKg: 620, appointmentBooked: true, items: [mug()], ...o,
});
