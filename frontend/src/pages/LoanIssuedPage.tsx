import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loanFulfillmentApi } from '../api/loanFulfillment';
import { LoanFulfillmentHistory } from '../components/LoanFulfillmentHistory';
import { errorMessage, money } from '../lib';
import type { LoanApplication } from '../types';
import { formatDateTime } from '../loanFulfillment/types';
import '../loanFulfillment/styles.css';

export function LoanIssuedPage() {
  const { id = '' } = useParams();
  const [application, setApplication] = useState<LoanApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const operation = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    generation.current += 1;
    setApplication(null); setLoading(true); setError(''); setBusy(false);
    loanFulfillmentApi.get(id).then(result => { if (active) setApplication(result); })
      .catch((err: unknown) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; generation.current += 1; };
  }, [id, attempt]);

  async function issue() {
    if (operation.current) return;
    operation.current = true;
    const started = generation.current;
    setBusy(true); setError('');
    try {
      const result = await loanFulfillmentApi.issue(id);
      if (started === generation.current) setApplication(result);
    } catch (err) { if (started === generation.current) setError(errorMessage(err)); }
    finally { operation.current = false; if (started === generation.current) setBusy(false); }
  }

  const state = application?.fulfillment;
  const issued = state?.status === 'ISSUED' && !!state.issuedAt;
  return <div className="loan-fulfillment">
    <Link className="inline-link" to="/applications">← Все заявки</Link>
    <div className="page-heading"><p className="eyebrow">Завершение оформления</p>
      <h1>{issued ? 'Кредит успешно выдан' : 'Демонстрационная выдача кредита'}</h1>
      <p>Демонстрационная операция — движение денежных средств не выполняется.</p></div>
    {loading && <p className="loading" role="status">Загружаем состояние оформления…</p>}
    {error && <div className="error" role="alert"><p>{error}</p>
      {!application && <button className="button button-black" onClick={() => setAttempt(value => value + 1)}>Повторить загрузку</button>}</div>}
    {application && (!state?.signedAt ? <section className="card">
      <h2>Сначала подтвердите подписание</h2><p>Выдача доступна после загрузки PDF и подтверждения.</p>
      <Link className="button" to={`/applications/${id}/sign`}>Перейти к договору</Link>
    </section> : <>
      <section className="card fulfillment-result" aria-busy={busy}>
        {issued && <div className="fulfillment-success-mark" aria-hidden="true">✓</div>}
        <span className="fulfillment-badge">{issued ? 'Выдан' : 'Готов к демонстрационной выдаче'}</span>
        <p className="fulfillment-result-amount">{money(state.contract.amount)}</p>
        <dl className="fulfillment-values">
          <div><dt>Номер договора</dt><dd>{state.contract.number}</dd></div>
          <div><dt>Заёмщик</dt><dd>{state.contract.borrower.companyName}</dd></div>
          {state.issuedAt && <div><dt>Дата выдачи</dt><dd>{formatDateTime(state.issuedAt)}</dd></div>}
        </dl>
        {issued ? <><p className="success">Результат сохранён. Повторная выдача не выполняется.</p>
          <Link className="button" to="/applications">Вернуться к заявкам</Link></>
          : <><p>Запустите симуляцию, чтобы завершить оформление кредита.</p>
            <button className="button" disabled={busy} onClick={() => void issue()}>Запустить симуляцию выдачи</button></>}
        {busy && <p className="fulfillment-progress" role="status"><span className="fulfillment-spinner" aria-hidden="true" />Обрабатываем демонстрационную операцию…</p>}
        <p className="hint">Демонстрационная операция. Денежные средства не перечисляются, обязательства не возникают.</p>
      </section>
      <LoanFulfillmentHistory history={state.history} />
    </>)}
  </div>;
}
