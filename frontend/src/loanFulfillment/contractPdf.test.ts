import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractParagraphs, generateContractPdf } from './contractPdf';
import type { DemoContract } from './types';

const contract: DemoContract = {
  number: 'DEMO-test-123', applicationId: 'test-123', generatedAt: '2026-10-26T10:00:00Z',
  borrower: { fullName: 'Иван Иванов', companyName: 'ООО Демо', inn: '1234567890' },
  borrowerSource: 'application', amount: 1_000_000, months: 24, annualRate: 22,
  monthlyPayment: 51_878.15, purpose: 'Развитие бизнеса', productName: 'На развитие',
};
afterEach(() => vi.unstubAllGlobals());

describe('демонстрационный PDF-договор', () => {
  it('содержит зафиксированные реквизиты, условия, предупреждение и место подписи', () => {
    const text = contractParagraphs(contract).join('\n');
    for (const value of [contract.number, contract.applicationId, contract.borrower.fullName,
      contract.borrower.companyName, contract.borrower.inn, '24 мес.', '22%',
      'Не имеет юридической силы', 'Условная подпись', '51', '878,15']) expect(text).toContain(value);
    expect(text).not.toContain('Реквизиты старой заявки');
    expect(contractParagraphs({ ...contract, borrowerSource: 'current-profile' }).join(' ')).toContain('из текущей анкеты');
  });

  it('создаёт настоящий многостраничный PDF с встроенным шрифтом и длинными русскими названиями', async () => {
    const font = await readFile(new URL('../../public/fonts/DejaVuSans.ttf', import.meta.url));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(font)));
    const pdf = await generateContractPdf({ ...contract,
      borrower: { ...contract.borrower, companyName: 'Очень длинное название компании '.repeat(200) },
    });
    expect(pdf.type).toBe('application/pdf');
    const text = await pdf.text();
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).toContain('/FontFile2');
    expect(text).toContain('/ToUnicode');
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(text).toContain('%%EOF');
  });
});
