import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { parseDate, parseHs, parseWorkbook } from '@/lib/parse';
import { runChecks } from '@/lib/rules';
import { londonToday } from '@/lib/dates';

const root = path.join(__dirname, '..');
const load = (p: string) => parseWorkbook(fs.readFileSync(path.join(root, p)));
const real = (b: ReturnType<typeof runChecks>) => b.issues.filter((i) => i.severity !== 'Info').map((i) => i.ruleId);

describe('parseDate', () => {
  it('reads DD-MM-YYYY day-first', () => {
    expect(parseDate('05-11-2026').iso).toBe('2026-11-05');
    expect(parseDate('05/11/2026').iso).toBe('2026-11-05');
    expect(parseDate('5.11.2026').iso).toBe('2026-11-05');
  });
  it('reads excel serials and Date objects', () => {
    expect(parseDate(46331).iso).toBe('2026-11-05');
    expect(parseDate(new Date(2026, 10, 5)).iso).toBe('2026-11-05');
  });
  it('rejects nonsense', () => {
    expect(parseDate('31-02-2026').invalid).toBe(true);
    expect(parseDate('soon').invalid).toBe(true);
    expect(parseDate('').invalid).toBe(false);
  });
});
describe('parseHs', () => {
  it('numbers become integer strings', () => expect(parseHs(691200.0)).toBe('691200'));
  it('text is kept', () => expect(parseHs(' 0901.11 ')).toBe('0901.11'));
  it('blank is null', () => expect(parseHs('')).toBeNull());
});

describe('template file', () => {
  const { bookings, warnings } = load('docs/Case2_Shipment_Booking_Test_Data_Format.xlsx');
  it('parses BK-001 with its item', () => {
    expect(warnings).toEqual([]);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ bookingId: 'BK-001', readyDate: '2026-11-05', pallets: 3, appointmentBooked: true });
    expect(bookings[0].items[0]).toMatchObject({ sku: 'MUG-01', hsCode: '691200', quantity: 1080 });
  });
  it('passes every rule', () => {
    expect(real(runChecks(bookings[0], { today: '2026-10-25' }))).toEqual([]);
  });
});

describe('generated sample', () => {
  const { bookings, warnings } = load('public/sample-test-data.xlsx');
  const res = Object.fromEntries(bookings.map((b) => [b.bookingId, runChecks(b, { today: londonToday() })]));
  it('has no orphan items', () => expect(warnings).toEqual([]));
  const expectIds: Record<string, string[]> = {
    'BK-001': [], 'BK-002': ['R-01'], 'BK-003': ['R-01'], 'BK-004': ['R-02'], 'BK-005': ['R-03'],
    'BK-006': ['R-03', 'R-04'], 'BK-007': ['R-05'], 'BK-008': [], 'BK-009': ['R-06'], 'BK-010': [],
    'BK-011': ['R-07'], 'BK-012': ['R-08'], 'BK-013': ['R-09'], 'BK-014': ['R-10'], 'BK-015': ['DATA-01'],
  };
  for (const [id, ids] of Object.entries(expectIds)) {
    it(`${id} raises exactly ${ids.join(', ') || 'nothing'}`, () => expect(real(res[id]).sort()).toEqual(ids));
  }
  it('BK-008 excludes C and recommends B', () => {
    expect(res['BK-008'].recommendation.recommended?.carrier).toBe('Carrier B');
    expect(res['BK-008'].issues.some((i) => i.ruleId === 'R-05' && i.severity === 'Info')).toBe(true);
  });
  it('BK-003 mentions the leading zero', () => {
    expect(res['BK-003'].issues[0].whatsWrong).toContain('090111');
  });
});

describe('robustness', () => {
  const build = (bRows: unknown[][], iRows: unknown[][]) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bRows), 'Sheet A');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(iRows), 'Sheet B');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  };
  const bh = ['booking id', ' Seller NAME ', 'Origin city', 'Origin country', 'Destination city', 'Destination country', 'Destination type', 'Ready to ship date', 'Seller priority', 'Pallets', 'Cartons', 'Total declared value', 'Currency', 'Total gross weight (kg)', 'Delivery appointment booked'];
  const ih = ['Booking ID', 'SKU', 'Description', 'HS code', 'Quantity (units)', 'Unit price', 'Units per carton', 'Cartons', 'Unit weight (kg)', 'Country of origin'];
  it('falls back to first two sheets, finds header on any row, tolerates case', () => {
    const r = parseWorkbook(build(
      [['junk'], [], bh, ['BK-9', 'X', 'london', 'United Kingdom', 'berlin', 'germany', 'warehouse', '01-12-2026', 'cheapest', 1, 10, 100, 'GBP', 200, 'yes']],
      [ih, ['BK-9', 'S', 'Mug', 691200, 10, 10, 1, 10, 0.5, 'China'], ['NOPE', 'Z', 'Orphan', null, 1, 1, 1, 1, 1, null]],
    ));
    expect(r.bookings[0]).toMatchObject({ destinationCity: 'Berlin', destinationCountry: 'Germany', priority: 'Cheapest', destinationType: 'Warehouse', appointmentBooked: true });
    expect(r.warnings.map((w) => w.ruleId)).toEqual(['DATA-04']);
  });
  it('flags non-numeric, negative and duplicate ids', () => {
    const row = (id: string, pallets: unknown) => [id, 'X', 'London', 'United Kingdom', 'Berlin', 'Germany', 'Warehouse', '01-12-2026', 'Cheapest', pallets, 10, 100, 'GBP', 200, 'Yes'];
    const r = parseWorkbook(build([bh, row('A', 'two'), row('B', -1), row('B', 1)], [ih]));
    const ids = r.bookings.flatMap((b) => b.parseIssues!.map((i) => i.ruleId));
    expect(ids).toContain('DATA-06');
    expect(ids).toContain('DATA-05');
  });
  it('drops the grey template example when the data also uses BK-001', () => {
    const ex = ['BK-001', 'Northfield Goods', 'Manchester', 'United Kingdom', 'Frankfurt', 'Germany', 'Warehouse', '05-11-2026', 'Cheapest', 3, 90, 5400, 'GBP', 620, 'Yes'];
    const exItem = ['BK-001', 'MUG-01', 'Ceramic coffee mug, 350 ml', 691200, 1080, 5, 12, 90, 0.5, 'United Kingdom'];
    const mine = ['BK-001', 'Pennine Crafts', 'Leeds', 'United Kingdom', 'Paris', 'France', 'Business address', '12-11-2026', 'Fastest', 1, 20, 900, 'GBP', 180, 'No'];
    const mineItem = ['BK-001', 'QLT-01', 'Handmade cotton quilt', 940490, 20, 45, 1, 20, 6, 'United Kingdom'];
    const r = parseWorkbook(build([['title'], bh, ex, mine], [['title'], ih, exItem, mineItem]));
    expect(r.bookings).toHaveLength(1);
    expect(r.bookings[0]).toMatchObject({ sellerName: 'Pennine Crafts', pallets: 1 });
    expect(r.bookings[0].items.map((i) => i.sku)).toEqual(['QLT-01']);
    expect(r.bookings[0].parseIssues).toEqual([]);
    expect(r.warnings.map((w) => [w.ruleId, w.severity])).toEqual([['DATA-10', 'Info']]);
    expect(real(runChecks(r.bookings[0], { today: '2026-10-25' }))).toEqual([]);
  });
  it('keeps the example row when no other booking uses BK-001', () => {
    const ex = ['BK-001', 'Northfield Goods', 'Manchester', 'United Kingdom', 'Frankfurt', 'Germany', 'Warehouse', '05-11-2026', 'Cheapest', 3, 90, 5400, 'GBP', 620, 'Yes'];
    const other = ['BK-002', 'Pennine Crafts', 'Leeds', 'United Kingdom', 'Paris', 'France', 'Business address', '12-11-2026', 'Fastest', 1, 20, 900, 'GBP', 180, 'No'];
    const r = parseWorkbook(build([bh, ex, other], [ih]));
    expect(r.bookings.map((b) => b.bookingId)).toEqual(['BK-001', 'BK-002']);
    expect(r.warnings).toEqual([]);
  });
  it('throws a clear error without a Booking ID header', () => {
    expect(() => parseWorkbook(build([['a', 'b']], [['c']]))).toThrow(/Booking ID/);
  });
});
