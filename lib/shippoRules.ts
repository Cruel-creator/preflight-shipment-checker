import { scanDescription } from '@/lib/rules/dangerous';
import { isEu, profileFor } from '@/lib/countries';
import type { Issue, PassedCheck } from '@/lib/types';
import type { Goods, ShippoAddress, ShippoParcel } from '@/lib/shippo';

export interface ShipmentInput { from: ShippoAddress; to: ShippoAddress; parcel: ShippoParcel; goods?: Goods }

export const needsCustoms = (fromC: string, toC: string) => {
  const a = fromC.toUpperCase(), b = toC.toUpperCase();
  if (a === b) return false;
  return !(isEu(a) && isEu(b));
};

const issue = (id: string, severity: Issue['severity'], title: string, whatsWrong: string, whyItMatters: string, howToFix: string[]): Issue => ({ ruleId: id, severity, title, whatsWrong, whyItMatters, howToFix });

/** Pre-flight checks for any shipment, interpreted for the country of dispatch. */
export function checkShipment(s: ShipmentInput): { issues: Issue[]; passed: PassedCheck[] } {
  const issues: Issue[] = [];
  const passed: PassedCheck[] = [];
  const g = s.goods ?? {};
  const fromC = s.from.country.toUpperCase();
  const toC = s.to.country.toUpperCase();
  const prof = profileFor(fromC);
  const cur = prof?.currency ?? '';
  const customs = needsCustoms(fromC, toC);
  const desc = g.description?.trim();

  // P-01 dangerous goods
  if (desc) {
    const hit = scanDescription(desc);
    if (hit) {
      issues.push(issue('P-01', 'Red', 'Possible dangerous goods', `"${desc}": ${hit.reason}`, 'Batteries, aerosols and flammable liquids are restricted by parcel carriers and airlines. Undeclared, they can be seized, fined or refused.', ['Remove the item, or ship it through a carrier and service approved for dangerous goods with the correct labelling.', 'If it is actually safe (battery-free, non-flammable), say so in the description and re-check.']));
    } else passed.push({ ruleId: 'P-01', label: 'No dangerous goods spotted', detail: `Checked the description "${desc}".` });
  }

  // P-07 volumetric weight
  const vol = (s.parcel.lengthCm * s.parcel.widthCm * s.parcel.heightCm) / 5000;
  if (vol > s.parcel.weightKg * 1.01) {
    issues.push(issue('P-07', 'Info', 'You may be billed on volumetric weight', `The box is ${s.parcel.lengthCm}×${s.parcel.widthCm}×${s.parcel.heightCm} cm, which counts as about ${vol.toFixed(1)} kg (L×W×H ÷ 5000) versus ${s.parcel.weightKg} kg actual.`, 'Most carriers charge on whichever is higher, so the price may rise at pickup if the quote used actual weight.', ['Use a smaller box if you can, or expect the higher chargeable weight.']));
  } else passed.push({ ruleId: 'P-07', label: 'Chargeable weight', detail: `Actual ${s.parcel.weightKg} kg is not below volumetric ${vol.toFixed(1)} kg.` });

  if (!customs) {
    if (fromC === toC) passed.push({ ruleId: 'P-02', label: 'Domestic shipment', detail: `Both addresses are in ${prof?.name ?? fromC}: no customs paperwork needed.` });
    else passed.push({ ruleId: 'P-02', label: 'Intra-EU shipment', detail: 'Both countries are in the EU: no customs declaration needed.' });
    return { issues, passed };
  }

  // international: customs data
  const ctx = `${prof?.name ?? fromC} → ${toC}`;
  if (!desc || !(g.valueAmount && g.valueAmount > 0)) {
    issues.push(issue('P-02', 'Red', 'Customs details missing', `This shipment crosses a customs border (${ctx}) but ${!desc ? 'the goods description' : 'the declared value'} is missing.`, 'Customs needs a plain description and value of what is inside, or the parcel can be held or returned, and carriers may refuse to quote.', [`Add what is in the parcel and its value${cur ? ` in ${cur}` : ''}.`]));
  } else passed.push({ ruleId: 'P-02', label: 'Customs description and value given', detail: `${desc}, ${g.valueAmount} ${cur}`.trim() });

  const hs = g.hsCode?.replace(/[\s.]/g, '') ?? '';
  if (!/^\d{6,}$/.test(hs)) {
    issues.push(issue('P-03', 'Amber', 'HS code missing or too short', hs ? `HS code "${g.hsCode}" is not a valid 6+ digit code.` : 'No HS code was given.', 'The HS code classifies the goods for duty and import rules. Without it the parcel is more likely to be delayed or charged the wrong duty.', ['Look up the 6-digit (or longer) code for the product on the tariff of your country, and enter digits only.']));
  } else passed.push({ ruleId: 'P-03', label: 'HS code given', detail: hs });

  if (!g.originCountry?.trim()) {
    issues.push(issue('P-04', 'Amber', 'Country of origin missing', 'No country of origin for the goods.', 'Customs uses where the goods were made, not where they ship from, to set duty and origin rules.', ['Add the country where the product was made.']));
  } else passed.push({ ruleId: 'P-04', label: 'Country of origin given', detail: g.originCountry.toUpperCase() });

  if (prof?.exportThreshold && g.valueAmount && g.valueAmount > prof.exportThreshold) {
    issues.push(issue('P-05', 'Amber', `Formal export filing likely (over ${prof.exportThreshold.toLocaleString('en-GB')} ${prof.currency})`, `Declared value ${g.valueAmount.toLocaleString('en-GB')} ${prof.currency} is above the usual ${prof.exportThreshold.toLocaleString('en-GB')} ${prof.currency} threshold for ${prof.name}.`, 'Above the threshold an export declaration is normally required before the carrier can move the goods.', prof.exportNotes));
  }
  if (prof) issues.push(issue('P-06', 'Info', `Export from ${prof.name}: what usually applies`, prof.exportNotes.join(' '), 'Advisory guidance for the country of dispatch — check current rules with your customs authority or broker.', ['Commercial invoice with seller, buyer, description, HS code, origin and value.']));
  else issues.push(issue('P-06', 'Info', `No country profile for ${fromC}`, `We have no export notes or currency profile for ${fromC}, so only the generic checks ran.`, 'Rates are still live, but dispatch-country rules are not applied.', ['Check export requirements with the customs authority of the dispatch country.']));
  return { issues, passed };
}
