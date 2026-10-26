import { withMockApplication } from './mock';
import { monthlyPayment } from '../lib';
import { assertApproved, assertContractConditions, requireFulfillment, validatePdf } from '../loanFulfillment/rules';
import type { FulfillmentEvent, LoanFulfillmentApi } from '../loanFulfillment/types';

const event = (type: FulfillmentEvent['type'], at = new Date().toISOString()): FulfillmentEvent => (
  { id: crypto.randomUUID(), type, at }
);
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 600));

// Read/check/write contains no awaits. Recheck ownership and state after every async operation.
export const mockLoanFulfillment: LoanFulfillmentApi = {
  get: id => withMockApplication(id, application => {
    assertApproved(application);
    return application;
  }),
  prepareContract: id => withMockApplication(id, (application, account) => {
    assertApproved(application);
    assertContractConditions(application);
    if (application.fulfillment) return application;
    const source = application.borrowerSnapshot ?? account.profile;
    if (!source?.fullName || !source.companyName || !source.inn) {
      throw new Error('Для формирования договора заполните реквизиты заёмщика.');
    }
    const now = new Date().toISOString();
    application.fulfillment = {
      status: 'AWAITING_SIGNATURE',
      contract: {
        number: `DEMO-${application.id}`, applicationId: application.id, generatedAt: now,
        borrower: { fullName: source.fullName, companyName: source.companyName, inn: source.inn },
        borrowerSource: application.borrowerSnapshot ? 'application' : 'current-profile',
        amount: application.amount, months: application.months, annualRate: application.annualRate!,
        monthlyPayment: monthlyPayment(application.amount, application.months, application.annualRate!),
        purpose: application.purpose, productName: application.bankOfferName ?? application.productName,
      },
      history: [event('SUBMITTED', application.createdAt), event('APPROVAL_OBSERVED', now), event('CONTRACT_CREATED', now)],
    };
    return application;
  }),
  async downloadContract(id) {
    const initial = await withMockApplication(id, (application, account) => {
      const state = requireFulfillment(application);
      assertContractConditions(application);
      return { contract: state.contract, userId: account.user.id };
    });
    const { generateContractPdf } = await import('../loanFulfillment/contractPdf');
    const blob = await generateContractPdf(initial.contract);
    return withMockApplication(id, (application, account) => {
      if (account.user.id !== initial.userId) throw new Error('Сессия изменилась. Повторите операцию.');
      const state = requireFulfillment(application);
      assertContractConditions(application);
      if (!state.downloadedAt) {
        state.downloadedAt = new Date().toISOString();
        state.history.push(event('CONTRACT_DOWNLOADED', state.downloadedAt));
      }
      return blob;
    });
  },
  async upload(id, file) {
    const initial = await withMockApplication(id, (application, account) => {
      const state = requireFulfillment(application);
      assertContractConditions(application);
      if (!state.downloadedAt) throw new Error('Сначала скачайте договор.');
      if (state.signedAt || state.status === 'ISSUED') throw new Error('После подписания документ нельзя заменить.');
      return { userId: account.user.id, documentId: state.document?.id };
    });
    await validatePdf(file);
    await pause();
    return withMockApplication(id, (application, account) => {
      if (account.user.id !== initial.userId) throw new Error('Сессия изменилась. Повторите операцию.');
      const state = requireFulfillment(application);
      assertContractConditions(application);
      if (!state.downloadedAt || state.signedAt || state.status === 'ISSUED') {
        throw new Error('Загрузка недоступна на текущем этапе.');
      }
      if (state.document?.id !== initial.documentId) throw new Error('Документ изменён в другой вкладке. Обновите страницу.');
      const now = new Date().toISOString();
      state.document = { id: crypto.randomUUID(), name: file.name, size: file.size, type: 'application/pdf', uploadedAt: now };
      state.status = 'DOCUMENT_UPLOADED';
      state.history.push(event('DOCUMENT_UPLOADED', now));
      return application;
    });
  },
  removeDocument: id => withMockApplication(id, application => {
    const state = requireFulfillment(application);
    assertContractConditions(application);
    if (state.signedAt || state.status === 'ISSUED') throw new Error('После подписания документ нельзя удалить.');
    if (state.document) {
      delete state.document;
      state.status = 'AWAITING_SIGNATURE';
      state.history.push(event('DOCUMENT_REMOVED'));
    }
    return application;
  }),
  async confirm(id) {
    const initial = await withMockApplication(id, (application, account) => {
      const state = requireFulfillment(application);
      assertContractConditions(application);
      if (!state.signedAt && (!state.downloadedAt || !state.document || state.status !== 'DOCUMENT_UPLOADED')) {
        throw new Error('Сначала скачайте и загрузите договор PDF.');
      }
      return { userId: account.user.id, documentId: state.document?.id };
    });
    await pause();
    return withMockApplication(id, (application, account) => {
      if (account.user.id !== initial.userId) throw new Error('Сессия изменилась. Повторите операцию.');
      const state = requireFulfillment(application);
      assertContractConditions(application);
      if (state.signedAt) return application;
      if (!state.downloadedAt || !state.document || state.status !== 'DOCUMENT_UPLOADED'
        || state.document.id !== initial.documentId) throw new Error('Документ изменён. Повторите подтверждение.');
      state.signedAt = new Date().toISOString();
      state.status = 'SIGNED';
      state.history.push(event('SIGNED', state.signedAt));
      return application;
    });
  },
  async issue(id) {
    const userId = await withMockApplication(id, (application, account) => {
      const state = requireFulfillment(application);
      assertContractConditions(application);
      if (!state.signedAt || !state.document || (state.status !== 'SIGNED' && state.status !== 'ISSUED')) {
        throw new Error('Выдача доступна только после подтверждения подписания.');
      }
      return account.user.id;
    });
    await pause();
    return withMockApplication(id, (application, account) => {
      if (account.user.id !== userId) throw new Error('Сессия изменилась. Повторите операцию.');
      const state = requireFulfillment(application);
      assertContractConditions(application);
      if (!state.signedAt || !state.document || (state.status !== 'SIGNED' && state.status !== 'ISSUED')) {
        throw new Error('Сначала подтвердите подписание.');
      }
      if (state.issuedAt) return application;
      state.issuedAt = new Date().toISOString();
      state.status = 'ISSUED';
      state.history.push(event('ISSUED', state.issuedAt));
      return application;
    });
  },
};
