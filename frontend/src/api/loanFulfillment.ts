import { useMocks } from './index';
import { mockLoanFulfillment } from './loanFulfillment.mock';
import { httpLoanFulfillment } from './loanFulfillment.http';
import type { LoanFulfillmentApi } from '../loanFulfillment/types';

export const loanFulfillmentApi: LoanFulfillmentApi = useMocks ? mockLoanFulfillment : httpLoanFulfillment;
