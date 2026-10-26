import { request, useMocks } from './index';
import type { LoanApplication } from '../types';

// Compatibility name for existing UI: all integration requests now go through Java.
export const formationDemo = !useMocks;
export interface FormationResult extends LoanApplication {
  formationStatus: string;
  source: 'csv' | 'manual' | 'legacy';
  company: { inn: string; ogrn: string | null; okved: string; legal_form: string; fullname: string };
  finances: { revenue: number; net_profit: number; current_loans: number | null; tax_arrears: number | null }[];
  calculated: Record<string, string | null>;
  warnings: string[];
}
export function formationRequest<T>(path: string): Promise<T> {
  return request<T>(path.startsWith('/applications/') ? path : `/formation${path}`);
}
export interface BankOffer {
  id: string; name: string; annualRate: number | null; ratePercent: number | null;
  rateText: string | null; rateUnit: 'annual' | 'monthly' | 'monthly_overpayment' | 'not_published';
  detailsUrl: string | null;
}
export interface RateQuote {
  offers: BankOffer[]; key: string; fetchedAt: string; source: string; collateral: boolean;
  legalForm: 'OOO' | 'IP'; businessAgeMonths: number; businessAgeBucket: string;
}
export function getQuote(collateral: boolean) {
  return request<RateQuote>(`/loans/quote?collateral=${collateral}`);
}
