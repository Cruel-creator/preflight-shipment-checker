// Country profiles for the "any shipment" mode: currency of the dispatch country plus the
// export notes that usually apply when goods leave it. Advisory only — not legal or customs advice.
export interface CountryProfile {
  code: string;
  name: string;
  currency: string;
  eu: boolean;
  /** Formal export declaration usually needed above this goods value (dispatch-country currency). */
  exportThreshold?: number;
  exportNotes: string[];
}

const EU_EXPORT = [
  'Moving goods to a destination outside the EU needs an export declaration (EX-A) lodged with your customs office, and an EORI number.',
  'Moving goods to another EU country needs no customs declaration, but keep an invoice showing the VAT treatment.',
];

const P = (code: string, name: string, currency: string, eu: boolean, exportNotes: string[], exportThreshold?: number): CountryProfile => ({ code, name, currency, eu, exportNotes, exportThreshold });

export const COUNTRY_PROFILES: CountryProfile[] = [
  P('GB', 'United Kingdom', 'GBP', false, [
    'Exports from the UK need an EORI number and a customs export declaration for goods leaving Great Britain (including to the EU).',
    'Include a commercial invoice with the seller, buyer, goods description, HS code, origin and value.',
  ]),
  P('DE', 'Germany', 'EUR', true, EU_EXPORT), P('FR', 'France', 'EUR', true, EU_EXPORT), P('NL', 'Netherlands', 'EUR', true, EU_EXPORT),
  P('IE', 'Ireland', 'EUR', true, EU_EXPORT), P('ES', 'Spain', 'EUR', true, EU_EXPORT), P('IT', 'Italy', 'EUR', true, EU_EXPORT),
  P('BE', 'Belgium', 'EUR', true, EU_EXPORT),
  P('US', 'United States', 'USD', false, [
    'Exports above US$2,500 per Schedule B commodity usually need Electronic Export Information (EEI) filed in AES, which gives an Internal Transaction Number (ITN).',
    'Some goods need an export licence regardless of value.',
  ], 2500),
  P('CA', 'Canada', 'CAD', false, ['Exports above about CA$2,000 per commodity group usually need an export declaration filed with the CBSA or your carrier.'], 2000),
  P('AU', 'Australia', 'AUD', false, ['Exports above about A$2,000 usually need an export declaration lodged with the Australian Border Force.'], 2000),
  P('IN', 'India', 'INR', false, ['Exporters need an Importer-Exporter Code (IEC) and a shipping bill filed via the carrier or a customs broker.']),
  P('CH', 'Switzerland', 'CHF', false, ['Exports need an export declaration (e-dec); Swiss VAT is normally zero-rated on proof of export.']),
  P('JP', 'Japan', 'JPY', false, ['Exports need an export declaration filed through NACCS, usually handled by the carrier or a broker.']),
  P('SG', 'Singapore', 'SGD', false, ['Most exports need a TradeNet permit; low-value consignments may be exempt.']),
];

export const profileFor = (code: string | undefined) => COUNTRY_PROFILES.find((c) => c.code === code?.toUpperCase());
export const isEu = (code: string) => !!profileFor(code)?.eu;
export const COUNTRY_OPTIONS = COUNTRY_PROFILES.map((c) => `${c.code} ${c.name}`);
