import { eventLabels, formatDateTime } from '../loanFulfillment/types';
import type { FulfillmentEvent } from '../loanFulfillment/types';

export function LoanFulfillmentHistory({ history }: { history: FulfillmentEvent[] }) {
  return <section className="card fulfillment-history">
    <h2>История оформления</h2>
    <ol>{history.map(item => <li key={item.id}>
      <span className="fulfillment-history-dot" aria-hidden="true" />
      <div><strong>{eventLabels[item.type]}</strong><time dateTime={item.at}>{formatDateTime(item.at)}</time></div>
    </li>)}</ol>
    <p className="hint">Время одобрения — момент получения решения модулем оформления.
      Даты промежуточных этапов рассмотрения не восстанавливаются задним числом.</p>
  </section>;
}
