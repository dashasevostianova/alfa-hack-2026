import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loanFulfillmentApi as api } from './loanFulfillment';

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe('контракт Java API оформления', () => {
  it('передаёт multipart без ручного Content-Type и использует cookie и CSRF', async () => {
    fetchMock.mockResolvedValueOnce(json({ headerName: 'X-CSRF-TOKEN', token: 'demo-token' }))
      .mockResolvedValueOnce(json({ id: '123' }));
    const file = new File(['%PDF-1.7'], 'signed.pdf', { type: 'application/pdf' });
    expect(await api.upload('123', file)).toEqual({ id: '123' });
    expect(fetchMock.mock.calls[0]).toEqual(['/api/auth/csrf', { credentials: 'include' }]);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/applications/123/fulfillment/document');
    expect(options?.method).toBe('POST');
    expect(options?.credentials).toBe('include');
    expect(options?.headers).toMatchObject({ 'X-CSRF-TOKEN': 'demo-token' });
    expect(options?.headers).not.toHaveProperty('Content-Type');
    expect((options?.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('скачивает PDF и отклоняет ответ иного формата', async () => {
    fetchMock.mockResolvedValueOnce(new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } }));
    expect((await api.downloadContract('123')).type).toBe('application/pdf');
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('include');
    fetchMock.mockResolvedValueOnce(json({ message: 'not pdf' }));
    await expect(api.downloadContract('123')).rejects.toThrow('не вернул PDF');
  });

  it('сообщает о недоступной заявке без переключения в моки', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'Заявка не найдена или недоступна.' }, 404));
    await expect(api.get('123')).rejects.toThrow('не найдена');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('завершает клиентскую сессию при 401, включая получение CSRF', async () => {
    const expired = vi.fn();
    window.addEventListener('session-expired', expired);
    fetchMock.mockResolvedValueOnce(json({ message: 'Нужен вход' }, 401));
    await expect(api.get('123')).rejects.toThrow('Нужен вход');
    fetchMock.mockResolvedValueOnce(json({ message: 'Сессия завершена' }, 401));
    await expect(api.confirm('123')).rejects.toThrow('Сессия завершена');
    expect(expired).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('передаёт серверный конфликт без повторного выполнения операции', async () => {
    fetchMock.mockResolvedValueOnce(json({ headerName: 'X-CSRF-TOKEN', token: 't' }))
      .mockResolvedValueOnce(json({ message: 'Договор изменён' }, 409));
    await expect(api.issue('123')).rejects.toThrow('Договор изменён');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
