import { beforeEach, describe, expect, it } from 'vitest';
import { buildModelFeatures, getModelDecision, saveModelDecision } from './model';
import type { FormationResult } from './formation';
import type { LoanApplication } from '../types';

const application: LoanApplication = {
  id: '42', createdAt: '2026-10-26T00:00:00Z', amount: 500_000, months: 24,
  purpose: 'Покупка оборудования', productId: 'product', productName: 'Кредит',
  annualRate: 20, status: 'SUBMITTED', decision: null,
};
const formation = {
  company: {
    inn: '1234567890', ogrn: null, okved: '62.01', legal_form: 'OOO',
    fullname: 'ООО Тест', registration_date: '2020-01-01',
  },
  finances: [{ revenue: 1_200_000, net_profit: -50_000, current_loans: 1 }],
} as FormationResult;

class MemoryStorage {
  private entries = new Map<string, string>();
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('оценка модели', () => {
  it('собирает восемь признаков из заявки и сохранённых данных', () => {
    expect(buildModelFeatures(application, formation)).toEqual({
      business_age_years: expect.any(Number),
      legal_form: 1,
      revenue: 1_200_000,
      net_profit: -50_000,
      current_loans: 1,
      purpose: 1,
      amount: 500_000,
      term_months: 24,
    });
  });

  it('кодирует ИП, нулевые долги и остальные цели', () => {
    expect(buildModelFeatures(
      { ...application, purpose: 'Ремонт помещения' },
      { ...formation, company: { ...formation.company, legal_form: 'IP' }, finances: [{ ...formation.finances[0], current_loans: 0 }] },
    )).toMatchObject({ legal_form: 0, current_loans: 0, purpose: 3 });
  });

  it('отклоняет отсутствующие финансовые показатели и неизвестную цель', () => {
    expect(() => buildModelFeatures(application, { ...formation, finances: [] })).toThrow('отсутствуют финансовые показатели');
    expect(() => buildModelFeatures({ ...application, purpose: 'Other' as LoanApplication['purpose'] }, formation)).toThrow('нет кода модели');
  });

  it('сохраняет и восстанавливает решение по пользователю и заявке', () => {
    expect(getModelDecision('user-a', '42')).toBeNull();
    const decision = saveModelDecision('user-a', '42', 1);
    expect(decision.outcome).toBe('APPROVED');
    expect(getModelDecision('user-a', '42')).toEqual(decision);
    expect(getModelDecision('user-b', '42')).toBeNull();
  });
});
