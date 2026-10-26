import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, progressApplication } from './mock';
import type { ApplicationDraft, Profile } from '../types';

class MemoryStorage {
  private entries = new Map<string, string>();
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
  removeItem(key: string) { this.entries.delete(key); }
}
const profile: Profile = {
  fullName: 'Иван Иванов', email: 'test@example.com', phone: '+79991234567', passport: '1234 567890',
  companyName: 'ООО Тест', inn: '1234567890', industry: 'Торговля', monthlyRevenue: 500_000,
};
const draft: ApplicationDraft = {
  amount: 1_000_000, months: 24, purpose: 'Развитие бизнеса', productId: 'working-capital',
};
beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true });
});
describe('моковый пользовательский путь', () => {
  it('обрабатывает дубликат логина, неверный пароль, выход и повторный вход', async () => {
    expect(await mockApi.me()).toBeNull();
    await mockApi.register({ login: 'demo', password: 'DemoPassword1' });
    await expect(mockApi.register({ login: 'demo', password: 'OtherPassword1' })).rejects.toThrow('занят');
    await mockApi.logout();
    await expect(mockApi.login({ login: 'demo', password: 'bad' })).rejects.toThrow('Неверный');
    expect((await mockApi.login({ login: 'demo', password: 'DemoPassword1' })).login).toBe('demo');
  });
  it('блокирует заявку до заполнения данных, валидирует и разделяет аккаунты', async () => {
    await mockApi.register({ login: 'first', password: 'DemoPassword1' });
    await expect(mockApi.createApplication(draft)).rejects.toThrow('Сначала');
    await mockApi.saveProfile(profile);
    expect((await mockApi.me())?.profileComplete).toBe(true);
    await expect(mockApi.createApplication({ ...draft, months: 0 })).rejects.toThrow('параметры');
    await mockApi.createApplication(draft);
    await mockApi.logout();
    await mockApi.register({ login: 'second', password: 'DemoPassword1' });
    expect(await mockApi.getApplications()).toEqual([]);
    expect(await mockApi.getProfile()).toBeNull();
    await mockApi.login({ login: 'first', password: 'DemoPassword1' });
    expect(await mockApi.getApplications()).toHaveLength(1);
  });
  it('проходит четыре этапа и возвращает три варианта решения', async () => {
    await mockApi.register({ login: 'demo', password: 'DemoPassword1' });
    await mockApi.saveProfile(profile);
    for (const [amount, outcome] of [[1_000_000, 'APPROVED'], [3_000_000, 'REVISION'], [6_000_000, 'REJECTED']] as const) {
      const application = await mockApi.createApplication({ ...draft, amount });
      const start = Date.parse(application.createdAt);
      expect(progressApplication(application, start).status).toBe('SUBMITTED');
      expect(progressApplication(application, start + 5000).status).toBe('VERIFICATION');
      expect(progressApplication(application, start + 10000).status).toBe('REVIEW');
      expect(progressApplication(application, start + 15000).decision?.outcome).toBe(outcome);
    }
  });
});
