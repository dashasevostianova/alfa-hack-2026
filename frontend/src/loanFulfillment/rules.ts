import type { LoanApplication } from '../types';
import type { LoanFulfillment } from './types';

export const MAX_PDF_SIZE = 10 * 1024 * 1024;

export function assertApproved(application: LoanApplication) {
  if (application.status !== 'COMPLETED' || application.decision?.outcome !== 'APPROVED') {
    throw new Error('Оформление доступно только для одобренной заявки.');
  }
}

export function requireFulfillment(application: LoanApplication): LoanFulfillment {
  assertApproved(application);
  if (!application.fulfillment) throw new Error('Сначала сформируйте договор.');
  return application.fulfillment;
}

export function assertContractConditions(application: LoanApplication) {
  const { amount, months, annualRate } = application;
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(months) || months <= 0
    || annualRate == null || !Number.isFinite(annualRate) || annualRate < 0 || application.rateWarning) {
    throw new Error('Условия заявки неполны. Для оформления нужна подтверждённая годовая ставка.');
  }
  const contract = application.fulfillment?.contract;
  if (contract && (contract.amount !== amount || contract.months !== months || contract.annualRate !== annualRate)) {
    throw new Error('Условия заявки изменились после формирования договора. Оформление недоступно.');
  }
}

export function pdfMetadataError(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!/\.pdf$/i.test(file.name) || (file.type !== '' && file.type !== 'application/pdf')) {
    return 'Выберите документ PDF с расширением .pdf и типом application/pdf.';
  }
  if (file.size <= 0) return 'Выбранный файл пуст.';
  if (file.size > MAX_PDF_SIZE) return 'Размер PDF не должен превышать 10 МБ.';
  return null;
}

export async function validatePdf(file: File) {
  const error = pdfMetadataError(file);
  if (error) throw new Error(error);
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...header) !== '%PDF-') {
    throw new Error('Файл не содержит заголовок PDF. Выберите документ PDF.');
  }
  // This is a basic format check, never a signature or authenticity check.
}
