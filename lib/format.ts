export function money(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-GB', {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${neg ? '-' : ''}£${s}`;
}
export const num = (n: number, dp = 0) =>
  n.toLocaleString('en-GB', { maximumFractionDigits: dp });
/** 1 decimal place, for weights. */
export const kg = (n: number) => `${n.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
export const kgPlain = (n: number) => `${num(n, 1)} kg`;

export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}
export const dmy = (iso: string) => iso.split('-').reverse().join('-');
