export type Priority = 'Cheapest' | 'Fastest' | 'Most reliable' | 'Balanced';
export type Severity = 'Red' | 'Amber' | 'Info';

export interface Item {
  sku: string;
  description: string;
  hsCode: string | null; // ALWAYS a string; never do numeric maths on it
  quantity: number | null;
  unitPrice: number | null;
  unitsPerCarton: number | null;
  cartons: number | null;
  unitWeightKg: number | null;
  countryOfOrigin: string | null;
}

export interface Booking {
  bookingId: string;
  sellerName: string | null;
  originCity: string | null;
  originCountry: 'United Kingdom';
  destinationCity: string | null;
  destinationCountry: string | null;
  destinationType: 'Warehouse' | 'Business address' | null;
  readyDate: string | null; // ISO yyyy-mm-dd
  priority: Priority | null;
  pallets: number | null;
  cartons: number | null;
  declaredValue: number | null;
  currency: 'GBP';
  grossWeightKg: number | null;
  appointmentBooked: boolean | null;
  items: Item[];
  /** true = computed by the app in chat, not stated by the seller */
  derived?: Partial<Record<'cartons' | 'declaredValue', boolean>>;
  /** Input problems found while parsing an upload (DATA-xx). */
  parseIssues?: Issue[];
}

export interface Issue {
  ruleId: string; // 'R-01'..'R-10', or 'DATA-xx' for input problems
  severity: Severity;
  itemSku?: string;
  title: string;
  whatsWrong: string;
  whyItMatters: string;
  howToFix: string[];
}

export interface PassedCheck {
  ruleId: string;
  label: string;
  detail: string;
}

export interface CarrierOption {
  carrier: string;
  service: string;
  destination: string;
  pricePerPallet: number;
  transitDays: number;
  onTimePct: number;
  maxKgPerPallet: number;
}

export interface CarrierEvaluation extends CarrierOption {
  feasible: boolean;
  infeasibleReason?: string;
  totalCost: number | null;
  estimatedDelivery: string | null;
  /** Balanced score 0-1 (feasible carriers only, Balanced priority only). */
  score?: number;
  scoreBreakdown?: { cost: number; speed: number; reliability: number };
  rank?: number;
}

export interface Recommendation {
  priority: Priority | null;
  recommended: CarrierEvaluation | null;
  carriers: CarrierEvaluation[];
  reason: string;
  /** Carrier the priority alone would have picked, if weight ruled it out. */
  excludedPreferred?: CarrierEvaluation;
  notes: string[];
  weightPerPallet: number | null;
  assumptions: string[];
}

export type OverallStatus = 'Blocked' | 'Warnings' | 'Ready';

export interface CheckResult {
  issues: Issue[];
  passed: PassedCheck[];
  status: OverallStatus;
  statusLabel: string;
  recommendation: Recommendation;
  redCount: number;
  amberCount: number;
}

export interface Confirmation {
  route: string;
  carrierLine: string | null;
  pallets: number | null;
  cartons: number | null;
  grossWeightKg: number | null;
  totalCost: number | null;
  collectionDate: string | null;
  estimatedDelivery: string | null;
  status: OverallStatus;
  statusLabel: string;
  statusMessage: string;
  recommendationLabel: string;
  nextSteps: { text: string; advisory?: boolean }[];
}

export interface LlmDangerousHit {
  isDangerous: boolean;
  category?: string;
  reason?: string;
}
export interface HsSuggestion {
  code: string;
  note?: string;
}
export interface CheckOptions {
  /** ISO date for "today" in Europe/London; injected for tests. */
  today?: string;
  llmDangerous?: Record<string, LlmDangerousHit>;
  hsSuggestions?: Record<string, HsSuggestion>;
}
