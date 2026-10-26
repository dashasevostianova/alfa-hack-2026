import type { LoanFulfillmentApi } from '../loanFulfillment/types';

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

// Separate transport for PDF/FormData; the existing JSON request helper stays unchanged.
export async function fulfillmentRequest(path: string, method = 'GET', body?: FormData): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json, application/pdf' };
  const check = async (response: Response) => {
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { message?: string } | null;
      if (response.status === 404) throw new Error(error?.message || 'Заявка не найдена или недоступна.');
      throw new Error(error?.message || `Ошибка запроса (${response.status}).`);
    }
    return response;
  };
  if (method !== 'GET') {
    const csrf = await (await check(await fetch(`${baseUrl}/auth/csrf`, { credentials: 'include' }))).json() as {
      headerName: string; token: string;
    };
    headers[csrf.headerName] = csrf.token;
  }
  return check(await fetch(`${baseUrl}${path}`, { method, headers, body, credentials: 'include' }));
}

const path = (id: string) => `/applications/${encodeURIComponent(id)}/fulfillment`;
const json = async (id: string, suffix = '', method = 'GET', body?: FormData) =>
  (await fulfillmentRequest(`${path(id)}${suffix}`, method, body)).json();

// Server operations persist the workflow and PDF in PostgreSQL.
export const httpLoanFulfillment: LoanFulfillmentApi = {
  get: id => json(id),
  prepareContract: id => json(id, '/contract', 'POST'),
  downloadContract: async id => {
    const response = await fulfillmentRequest(`${path(id)}/contract.pdf`);
    if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('application/pdf')) {
      throw new Error('Сервер не вернул PDF-договор.');
    }
    return response.blob();
  },
  upload: (id, file) => {
    const body = new FormData(); body.append('file', file);
    return json(id, '/document', 'POST', body);
  },
  removeDocument: id => json(id, '/document', 'DELETE'),
  confirm: id => json(id, '/confirm', 'POST'),
  issue: id => json(id, '/issue', 'POST'),
};
