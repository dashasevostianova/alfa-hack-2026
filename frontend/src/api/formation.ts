import { mockApi } from './mock';
import type { ApplicationDraft, LoanApplication, LoanProduct } from '../types';

export const formationDemo = import.meta.env.VITE_FORMATION_DEMO === 'true'
  || (import.meta.env.VITE_FORMATION_DEMO !== 'false' && import.meta.env.VITE_USE_MOCKS !== 'false');
export interface FormationResult extends LoanApplication {
  formationStatus: string;
  source: 'csv' | 'manual' | 'legacy';
  company: { inn: string; ogrn: string | null; okved: string; legal_form: string; fullname: string };
  finances: { revenue: number; net_profit: number; current_loans: number | null; tax_arrears: number | null }[];
  calculated: Record<string, string | null>;
  warnings: string[];
}
export async function formationRequest<T>(path: string, body?: unknown): Promise<T> {
  const user = await mockApi.me();
  if (!user) throw new Error('Войдите в демонстрационный кабинет.');
  const key = `alpha-formation-token:${user.id}`;
  let token = localStorage.getItem(key);
  if (!token) { token = crypto.randomUUID(); localStorage.setItem(key, token); }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`/api/formation${path}`, {
      method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.message || 'Python-модуль недоступен. Проверьте его запуск.');
    return result as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Сервер отвечает слишком долго. Повторите попытку: сохранённая заявка не будет создана повторно.');
    }
    throw error;
  } finally { clearTimeout(timeout); }
}
export const formationApi = {
  getProducts: () => formationRequest<LoanProduct[]>('/products').then(items => items.map(item => ({ ...item, annualRate: Number(item.annualRate) }))),
  getApplications: () => formationRequest<FormationResult[]>('/applications'),
  createApplication: async (draft: ApplicationDraft) => formationRequest<FormationResult>('/draft', { ...draft, profile: await mockApi.getProfile() }),
};
