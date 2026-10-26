import type { Api, LoanApplication, LoanProduct, Profile, User } from '../types';
import { mockApi } from './mock';

export const useMocks = import.meta.env.VITE_USE_MOCKS === 'true';
const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  // Java HttpSession: cookie-сессия + CSRF для всех изменяющих запросов, включая вход.
  if (method !== 'GET') {
    const csrfResponse = await fetch(`${baseUrl}/auth/csrf`, { credentials: 'include' });
    if (!csrfResponse.ok) throw new Error('Не удалось получить CSRF-токен.');
    const csrf: { headerName: string; token: string } = await csrfResponse.json();
    headers[csrf.headerName] = csrf.token;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401 && path === '/auth/me') return null as T;
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      window.dispatchEvent(new Event('session-expired'));
    }
    const error = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(error?.message || `Ошибка запроса (${response.status}).`);
  }
  const raw = await response.text();
  return raw ? JSON.parse(raw) as T : null as T;
}

const httpApi: Api = {
  me: () => request<User | null>('/auth/me'),
  login: (body) => request<User>('/auth/login', 'POST', body),
  register: (body) => request<User>('/auth/register', 'POST', body),
  logout: () => request<void>('/auth/logout', 'POST'),
  loginAvailable: async (login) => {
    const result = await request<{ available: boolean }>(`/auth/login-availability?login=${encodeURIComponent(login)}`);
    return result.available;
  },
  getProfile: () => request<Profile | null>('/profile'),
  saveProfile: (body) => request<Profile>('/profile', 'POST', body),
  getProducts: async () => (await request<LoanProduct[]>('/loans/products')).map(item => ({ ...item, id: String(item.id) })),
  getApplications: () => request<LoanApplication[]>('/applications'),
  createApplication: (body) => request<LoanApplication>('/applications', 'POST', body),
};

export const api: Api = useMocks ? mockApi : httpApi;
