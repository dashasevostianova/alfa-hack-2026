import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './index';
import { persistModelDecision } from './modelPersistence';

vi.mock('./index', () => ({ request: vi.fn() }));
beforeEach(() => { vi.mocked(request).mockReset(); });

describe('подтверждение модели для подписания', () => {
  it('передаёт только ID заявки и требует совпадающее серверное решение', async () => {
    const app = { id: '42', status: 'COMPLETED', decision: { outcome: 'APPROVED' } };
    vi.mocked(request).mockResolvedValue(app);
    expect(await persistModelDecision('42', 1)).toEqual(app);
    expect(request).toHaveBeenCalledWith('/applications/42/model-decision', 'POST');
  });
  it('не выдаёт локальное одобрение за разрешение сервера', async () => {
    vi.mocked(request).mockResolvedValue({ status: 'COMPLETED', decision: { outcome: 'REJECTED' } });
    await expect(persistModelDecision('42', 1)).rejects.toThrow('отличается');
  });
  it('не подменяет сбой сервера демонстрационным решением', async () => {
    vi.mocked(request).mockRejectedValue(new Error('Модель недоступна'));
    await expect(persistModelDecision('42', 1)).rejects.toThrow('Модель недоступна');
  });
});
