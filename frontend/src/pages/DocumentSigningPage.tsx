import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMocks } from '../api';
import { loanFulfillmentApi } from '../api/loanFulfillment';
import { DocumentUploader } from '../components/DocumentUploader';
import { LoanFulfillmentHistory } from '../components/LoanFulfillmentHistory';
import { errorMessage, money } from '../lib';
import type { LoanApplication } from '../types';
import { formatDateTime, fulfillmentLabels } from '../loanFulfillment/types';
import '../loanFulfillment/styles.css';

export function DocumentSigningPage() {
  const { id = '' } = useParams();
  const [application, setApplication] = useState<LoanApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const operation = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    generation.current += 1;
    setLoading(true); setError(''); setApplication(null); setBusy('');
    loanFulfillmentApi.get(id).then(value => { if (active) setApplication(value); })
      .catch((err: unknown) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; generation.current += 1; };
  }, [id, attempt]);

  async function run(label: string, action: () => Promise<LoanApplication | void>) {
    if (operation.current) return;
    operation.current = true;
    const started = generation.current;
    setBusy(label); setError('');
    try {
      const result = await action();
      if (started === generation.current && result) setApplication(result);
    } catch (err) { if (started === generation.current) setError(errorMessage(err)); }
    finally {
      operation.current = false;
      if (started === generation.current) setBusy('');
    }
  }

  async function download() {
    const blob = await loanFulfillmentApi.downloadContract(id);
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${application?.fulfillment?.contract.number ?? 'demo-contract'}.pdf`;
      document.body.append(anchor); anchor.click(); anchor.remove();
    } finally { setTimeout(() => URL.revokeObjectURL(url), 30_000); }
    return loanFulfillmentApi.get(id);
  }

  const state = application?.fulfillment;
  const contract = state?.contract;
  const signed = !!state?.signedAt;
  return <div className="loan-fulfillment">
    <Link className="inline-link" to="/applications">← Все заявки</Link>
    <div className="page-heading"><p className="eyebrow">Завершение оформления</p>
      <h1>Подписание кредитного договора</h1><p>Ознакомьтесь с условиями и подтвердите условное подписание.</p></div>
    <p className="fulfillment-notice">Демонстрационный сценарий. Юридически действительная подпись и реальные переводы не выполняются.</p>
    {loading && <p className="loading" role="status">Загружаем заявку…</p>}
    {error && <div className="error" role="alert"><p>{error}</p>
      {!application && <button className="button button-black" onClick={() => setAttempt(value => value + 1)}>Повторить загрузку</button>}</div>}
    {application && <>
      <section className="card">
        <div className="fulfillment-card-heading"><h2>Условия кредита</h2>
          <span className="fulfillment-badge">{state ? fulfillmentLabels[state.status] : 'Одобрено'}</span></div>
        <dl className="fulfillment-values">
          <div><dt>Номер заявки</dt><dd>{application.id}</dd></div>
          <div><dt>Сумма кредита</dt><dd>{money(contract?.amount ?? application.amount)}</dd></div>
          <div><dt>Срок</dt><dd>{contract?.months ?? application.months} мес.</dd></div>
          <div><dt>Годовая ставка</dt><dd>{(contract?.annualRate ?? application.annualRate) == null ? 'Не подтверждена' : `${contract?.annualRate ?? application.annualRate}%`}</dd></div>
          {contract && <>
            <div><dt>Заёмщик</dt><dd>{contract.borrower.fullName}</dd></div>
            <div><dt>Компания</dt><dd>{contract.borrower.companyName}</dd></div>
            <div><dt>Номер договора</dt><dd>{contract.number}</dd></div>
            <div><dt>Ежемесячный платёж, расчётный</dt><dd>{money(contract.monthlyPayment)}</dd></div>
          </>}
        </dl>
        {application.rateWarning && <p className="hint">{application.rateWarning}</p>}
        {contract?.borrowerSource === 'current-profile' && <p className="hint">У старой заявки нет снимка заёмщика.
          Реквизиты взяты из текущей анкеты и зафиксированы при формировании договора.</p>}
      </section>
      <section className="card" aria-busy={!!busy}>
        <h2>Кредитный договор</h2>
        <p>Демонстрационный документ. Не имеет юридической силы.</p>
        {!state ? <button className="button" disabled={!!busy}
          onClick={() => void run('Формируем договор…', () => loanFulfillmentApi.prepareContract(id))}>Сформировать договор</button>
          : <>
            <p className="hint">Сформирован {formatDateTime(state.contract.generatedAt)}. Номер и условия сохраняются при повторном скачивании.</p>
            <button className="button button-black" disabled={!!busy} onClick={() => void run('Готовим PDF…', download)}>Скачать договор PDF</button>
            {!signed && <>
              {!state.downloadedAt && <p className="hint">Сначала скачайте договор — затем станет доступна загрузка.</p>}
              <DocumentUploader document={state.document} disabled={!state.downloadedAt} busy={!!busy}
                onUpload={file => run('Принимаем PDF…', () => loanFulfillmentApi.upload(id, file))}
                onRemove={() => run('Удаляем документ…', () => loanFulfillmentApi.removeDocument(id))} />
              <button className="button" disabled={!!busy || !state.document}
                onClick={() => void run('Выполняем демонстрационную проверку…', () => loanFulfillmentApi.confirm(id))}>
                Подтвердить подписание</button>
            </>}
            {signed && <div className="fulfillment-confirmed"><p className="success">✓ Условное подписание подтверждено {formatDateTime(state.signedAt!)}</p>
              <Link className="button" to={`/applications/${id}/issued`}>{state.status === 'ISSUED' ? 'Посмотреть результат выдачи' : 'Перейти к выдаче кредита'}</Link></div>}
          </>}
        {!!busy && <p className="fulfillment-progress" role="status"><span className="fulfillment-spinner" aria-hidden="true" />{busy}</p>}
        {!useMocks && <p className="hint">Договор, загруженный PDF и состояние оформления сохраняются через Java API в базе данных.</p>}
      </section>
      {state && <LoanFulfillmentHistory history={state.history} />}
    </>}
  </div>;
}
