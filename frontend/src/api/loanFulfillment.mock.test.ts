import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, MOCK_KEY } from './mock';
import { mockLoanFulfillment as signing } from './loanFulfillment.mock';
import { monthlyPayment } from '../lib';
import { MAX_PDF_SIZE } from '../loanFulfillment/rules';
import type { LoanApplication, Profile } from '../types';

vi.mock('../loanFulfillment/contractPdf', () => ({
  generateContractPdf: vi.fn(async () => new Blob(['%PDF-1.7\ndemo'], { type: 'application/pdf' })),
}));

class MemoryStorage {
  private entries = new Map<string, string>();
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
  removeItem(key: string) { this.entries.delete(key); }
}
const profile: Profile = {
  fullName: 'Иван Иванов', email: 'demo@example.com', phone: '+79991234567', passport: '1234 567890',
  companyName: 'ООО Демонстрация', inn: '1234567890', industry: 'Торговля', monthlyRevenue: 500_000,
};
const file = () => new File(['%PDF-1.7\ndemo'], 'signed.pdf', { type: 'application/pdf' });

function storedChange(id: string, change: (application: LoanApplication) => void) {
  const db = JSON.parse(localStorage.getItem(MOCK_KEY)!);
  const application = db.accounts.flatMap((account: { applications: LoanApplication[] }) => account.applications)
    .find((application: LoanApplication) => application.id === id);
  change(application);
  localStorage.setItem(MOCK_KEY, JSON.stringify(db));
}
async function application(amount = 1_000_000) {
  return mockApi.createApplication({ amount, months: 24, purpose: 'Развитие бизнеса', productId: 'working-capital' });
}
async function approved() {
  const result = await application();
  vi.setSystemTime(Date.now() + 15_000);
  return result.id;
}
async function settle<T>(promise: Promise<T>): Promise<T> {
  return promise;
}
async function uploaded() {
  const id = await approved();
  await signing.prepareContract(id);
  await signing.downloadContract(id);
  await settle(signing.upload(id, file()));
  return id;
}

beforeEach(async () => {
  vi.stubGlobal('navigator', {});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-26T10:00:00Z'));
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  await mockApi.register({ login: 'demo', password: 'DemoPassword1' });
  await mockApi.saveProfile(profile);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('модуль подписания в существующей mock-базе', () => {
  it('не допускает ожидающие, отклонённые заявки и предложение изменить условия', async () => {
    const pending = await application();
    await expect(signing.prepareContract(pending.id)).rejects.toThrow('одобренной');
    const rejected = await application(6_000_000);
    const revision = await application(3_000_000);
    vi.setSystemTime(Date.now() + 15_000);
    for (const id of [rejected.id, revision.id]) {
      await expect(signing.get(id)).rejects.toThrow('одобренной');
      await expect(signing.prepareContract(id)).rejects.toThrow('одобренной');
      await expect(signing.downloadContract(id)).rejects.toThrow('одобренной');
      await expect(signing.upload(id, file())).rejects.toThrow('одобренной');
      await expect(signing.confirm(id)).rejects.toThrow('одобренной');
      await expect(signing.issue(id)).rejects.toThrow('одобренной');
    }
  });

  it('фиксирует данные заявки и заёмщика, повторное формирование не меняет договор', async () => {
    const id = await approved();
    await mockApi.saveProfile({ ...profile, fullName: 'Пётр Петров', companyName: 'ООО Новая анкета' });
    const first = (await signing.prepareContract(id)).fulfillment!;
    expect(first.contract).toMatchObject({
      applicationId: id, borrower: { fullName: profile.fullName, companyName: profile.companyName },
      amount: 1_000_000, months: 24, annualRate: 22, borrowerSource: 'application',
      monthlyPayment: monthlyPayment(1_000_000, 24, 22),
    });
    vi.setSystemTime(Date.now() + 1000);
    expect((await signing.prepareContract(id)).fulfillment).toEqual(first);
    expect(first.history[0].at).toBe('2026-10-26T10:00:00.000Z');
    expect(first.history[1].at).toBe('2026-10-26T10:00:15.000Z');
  });

  it('совместим со старой записью без новых полей и явно отмечает источник реквизитов', async () => {
    const id = await approved();
    storedChange(id, value => { delete value.borrowerSnapshot; });
    expect((await mockApi.getApplications())[0].fulfillment).toBeUndefined();
    expect((await signing.prepareContract(id)).fulfillment?.contract.borrowerSource).toBe('current-profile');
  });

  it('блокирует неизвестную ставку и изменение условий сформированного договора', async () => {
    const id = await approved();
    storedChange(id, value => { value.annualRate = null; });
    await expect(signing.prepareContract(id)).rejects.toThrow('годовая ставка');
    storedChange(id, value => { value.annualRate = 22; });
    await signing.prepareContract(id);
    storedChange(id, value => { value.months = 36; });
    await expect(signing.downloadContract(id)).rejects.toThrow('изменились');
    await expect(signing.confirm(id)).rejects.toThrow('изменились');
  });

  it('требует скачивание до загрузки и документ до подтверждения', async () => {
    const id = await approved();
    await expect(signing.confirm(id)).rejects.toThrow('сформируйте');
    await signing.prepareContract(id);
    await expect(signing.upload(id, file())).rejects.toThrow('скачайте');
    await expect(signing.confirm(id)).rejects.toThrow('загрузите');
    await signing.downloadContract(id);
    await expect(signing.confirm(id)).rejects.toThrow('загрузите');
  });

  it('отклоняет неверные расширение, MIME, заголовок, пустой и слишком большой файл', async () => {
    const id = await approved();
    await signing.prepareContract(id);
    await signing.downloadContract(id);
    for (const invalid of [
      new File(['%PDF-1.7'], 'contract.txt', { type: 'application/pdf' }),
      new File(['%PDF-1.7'], 'contract.pdf', { type: 'text/plain' }),
      new File(['plain text'], 'contract.pdf', { type: 'application/pdf' }),
      new File([], 'contract.pdf', { type: 'application/pdf' }),
      new File([new Uint8Array(MAX_PDF_SIZE + 1)], 'contract.pdf', { type: 'application/pdf' }),
    ]) await expect(signing.upload(id, invalid)).rejects.toThrow();
    expect((await signing.get(id)).fulfillment?.document).toBeUndefined();
  });

  it('принимает PDF с пустым браузерным MIME и хранит только метаданные', async () => {
    const id = await approved();
    await signing.prepareContract(id);
    await signing.downloadContract(id);
    const result = await settle(signing.upload(id, new File(['%PDF-1.7\n'], 'signed.PDF')));
    expect(result.fulfillment?.status).toBe('DOCUMENT_UPLOADED');
    expect(result.fulfillment?.document).toMatchObject({ name: 'signed.PDF', type: 'application/pdf' });
    expect(localStorage.getItem(MOCK_KEY)).not.toContain('%PDF-');
  });

  it('позволяет удалить документ и блокирует подтверждение до новой загрузки', async () => {
    const id = await uploaded();
    expect((await signing.removeDocument(id)).fulfillment?.status).toBe('AWAITING_SIGNATURE');
    await expect(signing.confirm(id)).rejects.toThrow('загрузите');
    expect((await settle(signing.upload(id, file()))).fulfillment?.status).toBe('DOCUMENT_UPLOADED');
  });

  it('не выдаёт кредит без подписания, повторные параллельные операции идемпотентны', async () => {
    const id = await uploaded();
    await expect(signing.issue(id)).rejects.toThrow('подписания');
    const signed = await settle(Promise.all([signing.confirm(id), signing.confirm(id)]));
    expect(signed[0].fulfillment?.signedAt).toBe(signed[1].fulfillment?.signedAt);
    await expect(signing.removeDocument(id)).rejects.toThrow('После подписания');
    await expect(signing.upload(id, file())).rejects.toThrow('После подписания');
    const issued = await settle(Promise.all([signing.issue(id), signing.issue(id)]));
    expect(issued[0].fulfillment?.issuedAt).toBe(issued[1].fulfillment?.issuedAt);
    const state = (await signing.get(id)).fulfillment!;
    expect(state.status).toBe('ISSUED');
    expect(state.history.filter(item => item.type === 'SIGNED')).toHaveLength(1);
    expect(state.history.filter(item => item.type === 'ISSUED')).toHaveLength(1);
    expect((await settle(signing.confirm(id))).fulfillment?.status).toBe('ISSUED');
  });

  it('сохраняет результат, историю и договор после перезагрузки модулей и обычного polling', async () => {
    const id = await uploaded();
    await settle(signing.confirm(id));
    const state = (await settle(signing.issue(id))).fulfillment!;
    vi.resetModules();
    const reloaded = (await import('./loanFulfillment.mock')).mockLoanFulfillment;
    expect((await reloaded.get(id)).fulfillment).toEqual(state);
    expect((await mockApi.getApplications())[0].fulfillment).toEqual(state);
    await mockApi.logout();
    await mockApi.login({ login: 'demo', password: 'DemoPassword1' });
    expect((await reloaded.get(id)).fulfillment).toEqual(state);
  });

  it('не даёт чужому пользователю читать или изменять заявку', async () => {
    const id = await uploaded();
    const before = (await signing.get(id)).fulfillment;
    await mockApi.register({ login: 'other', password: 'OtherPassword1' });
    for (const operation of [
      () => signing.get(id), () => signing.prepareContract(id), () => signing.downloadContract(id),
      () => signing.upload(id, file()), () => signing.removeDocument(id), () => signing.confirm(id), () => signing.issue(id),
    ]) await expect(operation()).rejects.toThrow('не найдена');
    await expect(signing.get('missing')).rejects.toThrow('не найдена');
    await mockApi.login({ login: 'demo', password: 'DemoPassword1' });
    expect((await signing.get(id)).fulfillment).toEqual(before);
  });

  it('повторно проверяет сессию после ожидания и отменяет операцию после выхода', async () => {
    const id = await uploaded();
    const pending = signing.confirm(id);
    await Promise.resolve();
    await mockApi.logout();
    await expect(settle(pending)).rejects.toThrow('Сессия');
    await mockApi.login({ login: 'demo', password: 'DemoPassword1' });
    expect((await signing.get(id)).fulfillment?.signedAt).toBeUndefined();
  });

  it('повторно проверяет документ, если его удалили во время подтверждения', async () => {
    const id = await uploaded();
    const pending = signing.confirm(id);
    await Promise.resolve();
    await signing.removeDocument(id);
    await expect(settle(pending)).rejects.toThrow('Документ изменён');
  });

  it('не даёт изменению решения во время ожидания завершить выдачу', async () => {
    const id = await uploaded();
    await settle(signing.confirm(id));
    const pending = signing.issue(id);
    await Promise.resolve();
    // Reuse the existing mock decision source: moving above its approval limit rejects the application.
    storedChange(id, value => { value.amount = 6_000_000; });
    await expect(settle(pending)).rejects.toThrow('одобренной');
  });
});
