import type { Decision, LoanApplication } from '../types';
import type { FormationResult } from './formation';

const modelBaseUrl = (import.meta.env.VITE_MODEL_BASE_URL || '/model').replace(/\/$/, '');
const decisionStorageKey = 'alpha-model-decisions-v1';

export interface ModelFeatures {
  business_age_years: number;
  legal_form: 0 | 1;
  revenue: number;
  net_profit: number;
  current_loans: 0 | 1;
  purpose: 0 | 1 | 2 | 3;
  amount: number;
  term_months: number;
}

export interface ModelDecision extends Decision {
  prediction: 0 | 1;
  evaluatedAt: string;
}

const purposeCodes: Record<LoanApplication['purpose'], ModelFeatures['purpose']> = {
  'Пополнение оборотных средств': 0,
  'Покупка оборудования': 1,
  'Развитие бизнеса': 2,
  'Ремонт помещения': 3,
};

function requiredNumber(value: number | null | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`В сохранённых данных заявки отсутствует показатель «${label}».`);
  }
  return value;
}

function businessAgeYears(registrationDate: string): number {
  const registered = new Date(`${registrationDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registrationDate) || !Number.isFinite(registered.getTime())) {
    throw new Error('В данных компании некорректная дата регистрации.');
  }
  const days = (Date.now() - registered.getTime()) / 86_400_000;
  if (days < 0) throw new Error('Дата регистрации компании не может быть в будущем.');
  return days / 365.2425;
}

export function buildModelFeatures(application: LoanApplication, formation: FormationResult): ModelFeatures {
  const finance = formation.finances[0];
  if (!finance) throw new Error('В сохранённых данных заявки отсутствуют финансовые показатели.');
  const legalForm = formation.company.legal_form;
  if (legalForm !== 'OOO' && legalForm !== 'IP') {
    throw new Error('Не удалось определить юридическую форму компании.');
  }
  const purpose = purposeCodes[application.purpose];
  if (purpose === undefined) throw new Error('Для этой цели кредита нет кода модели.');

  return {
    business_age_years: businessAgeYears(formation.company.registration_date),
    legal_form: legalForm === 'OOO' ? 1 : 0,
    revenue: requiredNumber(finance.revenue, 'выручка'),
    net_profit: requiredNumber(finance.net_profit, 'чистая прибыль'),
    current_loans: finance.current_loans != null && requiredNumber(finance.current_loans, 'текущие обязательства') > 0 ? 1 : 0,
    purpose,
    amount: requiredNumber(application.amount, 'сумма кредита'),
    term_months: requiredNumber(application.months, 'срок кредита'),
  };
}

export async function predictApplication(features: ModelFeatures): Promise<0 | 1> {
  const response = await fetch(`${modelBaseUrl}/predict`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(features),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(error?.message || `Модель недоступна (${response.status}).`);
  }
  const result = await response.json() as { prediction?: unknown };
  if (result.prediction !== 0 && result.prediction !== 1) {
    throw new Error('Модель вернула некорректный результат.');
  }
  return result.prediction;
}

function isModelDecision(value: unknown): value is ModelDecision {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<ModelDecision>;
  return (item.prediction === 0 || item.prediction === 1)
    && item.outcome === (item.prediction === 1 ? 'APPROVED' : 'REJECTED')
    && typeof item.summary === 'string'
    && Array.isArray(item.reasons)
    && Array.isArray(item.recommendations)
    && typeof item.evaluatedAt === 'string';
}

type StoredDecisions = Record<string, Record<string, ModelDecision>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStoredDecisions(): StoredDecisions {
  const raw = localStorage.getItem(decisionStorageKey);
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error('Локально сохранённые решения повреждены. Очистите данные сайта и повторите оценку.');
  }
  const decisions: StoredDecisions = {};
  for (const [userId, applications] of Object.entries(parsed)) {
    if (!isRecord(applications)) {
      throw new Error('Локально сохранённые решения повреждены. Очистите данные сайта и повторите оценку.');
    }
    decisions[userId] = applications as Record<string, ModelDecision>;
  }
  return decisions;
}

export function getModelDecision(userId: string, applicationId: string): ModelDecision | null {
  const value = readStoredDecisions()[userId]?.[applicationId];
  if (value === undefined) return null;
  if (!isModelDecision(value)) {
    throw new Error('Сохранённый результат модели повреждён. Повторите оценку заявки.');
  }
  return value;
}

export function saveModelDecision(userId: string, applicationId: string, prediction: 0 | 1): ModelDecision {
  const decision: ModelDecision = prediction === 1
    ? {
      prediction, outcome: 'APPROVED', summary: 'Модель оценила заявку как предварительно одобренную.',
      reasons: [], recommendations: [], evaluatedAt: new Date().toISOString(),
    }
    : {
      prediction, outcome: 'REJECTED', summary: 'Модель оценила заявку как не одобренную.',
      reasons: [], recommendations: [], evaluatedAt: new Date().toISOString(),
    };
  const stored = readStoredDecisions();
  stored[userId] = { ...stored[userId], [applicationId]: decision };
  localStorage.setItem(decisionStorageKey, JSON.stringify(stored));
  return decision;
}
