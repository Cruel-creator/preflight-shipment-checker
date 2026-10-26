import type { CarrierOption } from '@/lib/types';

// Fixed rate card from the case workbook ("Carrier options" sheet). Judges upload only
// Bookings + Items, so this lives in code.
const rows: [string, string, string, number, number, number, number][] = [
  ['Carrier A', 'Road economy', 'Germany', 180, 5, 92, 500],
  ['Carrier B', 'Road standard', 'Germany', 220, 3, 95, 750],
  ['Carrier C', 'Road express', 'Germany', 340, 2, 98, 400],
  ['Carrier A', 'Road economy', 'France', 170, 5, 92, 500],
  ['Carrier B', 'Road standard', 'France', 210, 3, 95, 750],
  ['Carrier C', 'Road express', 'France', 330, 2, 98, 400],
  ['Carrier A', 'Road economy', 'Netherlands', 160, 5, 92, 500],
  ['Carrier B', 'Road standard', 'Netherlands', 200, 3, 95, 750],
  ['Carrier C', 'Road express', 'Netherlands', 320, 2, 98, 400],
];

export const CARRIERS: CarrierOption[] = rows.map(
  ([carrier, service, destination, pricePerPallet, transitDays, onTimePct, maxKgPerPallet]) => ({
    carrier, service, destination, pricePerPallet, transitDays, onTimePct, maxKgPerPallet,
  }),
);

export const ORIGIN_COUNTRY = 'United Kingdom';
export const ORIGIN_CITIES = ['London', 'Manchester', 'Birmingham', 'Leeds'];
export const DESTINATIONS: Record<string, string[]> = {
  Germany: ['Berlin', 'Frankfurt', 'Hamburg'],
  France: ['Paris', 'Lyon'],
  Netherlands: ['Amsterdam', 'Rotterdam'],
};
export const DESTINATION_TYPES = ['Warehouse', 'Business address'] as const;
export const PRIORITIES = ['Cheapest', 'Fastest', 'Most reliable', 'Balanced'] as const;
export const ITEM_ORIGIN_COUNTRIES = ['United Kingdom', 'China', 'India', 'Vietnam', 'Turkey', 'Germany'];

/** Balanced weighting: see README for the reasoning. */
export const BALANCED_WEIGHTS = { cost: 0.4, speed: 0.3, reliability: 0.3 };

export const RULEBOOK: { id: string; rule: string; severity: 'Red' | 'Amber' }[] = [
  { id: 'R-01', rule: 'Every item has an HS code of at least 6 digits', severity: 'Red' },
  { id: 'R-02', rule: 'Declared value equals sum of quantity × unit price (within 1%)', severity: 'Red' },
  { id: 'R-03', rule: 'Units per carton × cartons equals quantity, per item', severity: 'Red' },
  { id: 'R-04', rule: 'Booking cartons equals sum of item cartons', severity: 'Red' },
  { id: 'R-05', rule: "Weight per pallet is within the chosen carrier's limit", severity: 'Red' },
  { id: 'R-06', rule: 'No lithium batteries, aerosols or flammable liquids', severity: 'Red' },
  { id: 'R-07', rule: 'Gross weight is at least the sum of unit weight × quantity', severity: 'Amber' },
  { id: 'R-08', rule: 'Warehouse deliveries have an appointment booked', severity: 'Amber' },
  { id: 'R-09', rule: 'Every item has a country of origin', severity: 'Amber' },
  { id: 'R-10', rule: 'Ready to ship date is not in the past', severity: 'Amber' },
];

export const DG_KEYWORDS = [
  'lithium', 'li-ion', 'li ion', 'lipo', 'battery', 'batteries', 'power bank', 'portable charger', 'mah',
  'rechargeable', 'cordless', 'bluetooth speaker', 'bluetooth headphones', 'bluetooth earbuds', 'wireless earbuds',
  'wireless headphones', 'e-cigarette', 'vape', 'drone', 'hoverboard', 'electric toothbrush',
  'aerosol', 'spray can', 'spray', 'hairspray', 'dry shampoo', 'shaving foam', 'propellant',
  'flammable', 'lighter fluid', 'butane',
  'petrol', 'gasoline', 'kerosene', 'paraffin', 'solvent', 'thinner', 'acetone', 'turpentine', 'methylated', 'isopropyl',
  'hand sanitiser', 'hand sanitizer', 'nail polish', 'nail varnish', 'varnish', 'lacquer', 'perfume', 'alcohol-based', 'ethanol', 'spirit',
];
