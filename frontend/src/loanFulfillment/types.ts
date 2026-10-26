import type { LoanApplication } from '../types';

export interface BorrowerSnapshot {
  fullName: string;
  companyName: string;
  inn: string;
}

export interface DemoContract {
  number: string;
  applicationId: string;
  generatedAt: string;
  borrower: BorrowerSnapshot;
  borrowerSource: 'application' | 'current-profile';
  amount: number;
  months: number;
  annualRate: number;
  monthlyPayment: number;
  purpose: string;
  productName: string;
}

export type FulfillmentStatus = 'AWAITING_SIGNATURE' | 'DOCUMENT_UPLOADED' | 'SIGNED' | 'ISSUED';
export interface FulfillmentEvent {
  id: string;
  type: 'SUBMITTED' | 'APPROVAL_OBSERVED' | 'CONTRACT_CREATED' | 'CONTRACT_DOWNLOADED'
    | 'DOCUMENT_UPLOADED' | 'DOCUMENT_REMOVED' | 'SIGNED' | 'ISSUED';
  at: string;
}
export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}
export interface LoanFulfillment {
  status: FulfillmentStatus;
  contract: DemoContract;
  downloadedAt?: string;
  document?: UploadedDocument;
  signedAt?: string;
  issuedAt?: string;
  history: FulfillmentEvent[];
}

export interface LoanFulfillmentApi {
  get(id: string): Promise<LoanApplication>;
  prepareContract(id: string): Promise<LoanApplication>;
  downloadContract(id: string): Promise<Blob>;
  upload(id: string, file: File): Promise<LoanApplication>;
  removeDocument(id: string): Promise<LoanApplication>;
  confirm(id: string): Promise<LoanApplication>;
  issue(id: string): Promise<LoanApplication>;
}

export const fulfillmentLabels: Record<FulfillmentStatus, string> = {
  AWAITING_SIGNATURE: 'Ожидает подписания', DOCUMENT_UPLOADED: 'Документ загружен',
  SIGNED: 'Подписано', ISSUED: 'Выдан',
};

export const eventLabels: Record<FulfillmentEvent['type'], string> = {
  SUBMITTED: 'Заявка отправлена', APPROVAL_OBSERVED: 'Одобрение получено модулем оформления',
  CONTRACT_CREATED: 'Договор сформирован', CONTRACT_DOWNLOADED: 'Договор подготовлен для скачивания',
  DOCUMENT_UPLOADED: 'PDF принят в демонстрационном режиме', DOCUMENT_REMOVED: 'Загруженный документ удалён',
  SIGNED: 'Условное подписание подтверждено', ISSUED: 'Демонстрационная выдача завершена',
};

export const formatDateTime = (value: string) => new Date(value).toLocaleString('ru-RU');
