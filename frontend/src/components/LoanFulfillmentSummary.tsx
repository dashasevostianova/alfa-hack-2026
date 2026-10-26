import { Link } from 'react-router-dom';
import type { LoanApplication } from '../types';
import { formatDateTime, fulfillmentLabels } from '../loanFulfillment/types';

export function LoanFulfillmentSummary({ application }: { application: LoanApplication }) {
  const state = application.fulfillment;
  return <div>
    {state && <p className="hint"><strong>{fulfillmentLabels[state.status]}</strong>
      {state.issuedAt && <> · {formatDateTime(state.issuedAt)} · Демонстрационная операция</>}</p>}
    <Link className="button" to={state?.signedAt
      ? `/applications/${application.id}/issued` : `/approved/${application.id}`}>
      {state?.status === 'ISSUED' ? 'Результат выдачи' : state?.status === 'SIGNED' ? 'Перейти к выдаче' : 'Перейти к подписанию'}
    </Link>
  </div>;
}
