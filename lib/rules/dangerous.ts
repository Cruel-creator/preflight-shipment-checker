import { DG_KEYWORDS } from '@/lib/data/reference';

// Phrases that negate a keyword ("lithium-free", "battery not included"). Removed before scanning
// so the keyword pass stays deterministic and avoids the obvious false positives on its own.
const NEGATIONS: RegExp[] = [
  /\b(lithium|li-ion|battery|batteries|aerosol|flammable|alcohol|solvent)[\s-]*free\b/gi,
  /\bnon[\s-]*(flammable|lithium|aerosol)\b/gi,
  /\bnot\s+(flammable|lithium)\b/gi,
  /\b(battery|batteries)\s+(not\s+included|excluded|sold\s+separately)\b/gi,
  /\b(no|without|excluding)\s+(battery|batteries|lithium|aerosol|propellant)\b/gi,
  /\bspirit\s+level\b/gi,
  /\bspray\s+(bottle\s+)?(cap|nozzle)\b/gi,
];

export interface DgHit {
  keyword: string;
  reason: string;
}

export function scanDescription(description: string): DgHit | null {
  let text = ` ${description.toLowerCase()} `;
  for (const n of NEGATIONS) text = text.replace(n, ' ');
  for (const kw of DG_KEYWORDS) {
    const re = new RegExp(`(^|[^a-z])${kw.replace(/[-\s]/g, '[-\\s]?')}([^a-z]|$)`, 'i');
    if (re.test(text)) {
      if (kw === 'perfume') {
        return { keyword: kw, reason: 'Check — perfumes are often flammable liquids (alcohol-based).' };
      }
      if (['battery', 'batteries', 'lithium', 'li-ion', 'li ion', 'lipo', 'power bank'].includes(kw)) {
        return { keyword: kw, reason: `"${kw}" suggests a lithium/other battery, which is dangerous goods.` };
      }
      if (['aerosol', 'spray can', 'spray', 'propellant'].includes(kw)) {
        return { keyword: kw, reason: `"${kw}" suggests an aerosol (pressurised container), which is dangerous goods.` };
      }
      return { keyword: kw, reason: `"${kw}" suggests a flammable liquid, which is dangerous goods.` };
    }
  }
  return null;
}

/** HS headings 8506 (primary cells/batteries) and 8507 (accumulators, incl. lithium-ion). */
export function dgHsHeading(hs: string | null): string | null {
  if (!hs) return null;
  const digits = hs.replace(/[\s.]/g, '');
  if (digits.startsWith('8506')) return '8506 (primary cells and batteries)';
  if (digits.startsWith('8507')) return '8507 (electric accumulators, incl. lithium-ion)';
  return null;
}
