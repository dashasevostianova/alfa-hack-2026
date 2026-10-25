import { formationDemo } from '../api/formation';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { StatusStepper } from '../components/StatusStepper';
import { errorMessage, money } from '../lib';
import { useSession } from '../session';
import type { LoanApplication } from '../types';

export function ApplicationsPage() {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { user } = useSession();
  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const items = await api.getApplications();
        if (!active) return;
        setApplications(items); setError('');
        if (items.some((item) => item.status !== 'COMPLETED')) timeout = setTimeout(load, 3000);
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); };
  }, [attempt]);

  return <>
    <div className="page-heading"><p className="eyebrow">История обращений</p>
      <h1>Ваши заявки</h1><p>Следите за рассмотрением и узнавайте решения здесь.</p></div>
    {error && <div className="error" role="alert">{error} <button className="inline-link" onClick={() => setAttempt(attempt + 1)}>Повторить загрузку</button></div>}
    {loading ? <p className="loading" role="status">Загружаем заявки…</p> : (
      applications.length === 0 && !error ? <div className="card empty-state"><span className="empty-symbol" aria-hidden="true">↗</span>
        <h2>Здесь будут ваши заявки</h2><p>Подберите условия кредита и отправьте первую заявку.</p>
        <Link className="button" to={user?.profileComplete ? '/calculator' : '/data'}>
          {user?.profileComplete ? 'Подобрать кредит' : 'Заполнить данные'}</Link></div> :
      applications.map((item) => <article className="card application" key={item.id}>
        <div className="application-heading"><div>
          <p className="eyebrow">Заявка от {new Date(item.createdAt).toLocaleDateString('ru-RU')}</p>
          <h2>{item.purpose}</h2><p className="muted">{item.productName} · {item.months} мес. · {item.annualRate}% годовых</p>
        </div><strong className="application-amount">{money(item.amount)}</strong></div>
        <StatusStepper status={item.status} />
        {formationDemo && <p className="hint">Рассмотрение заявки и решение демонстрационные.
          {' '}<Link className="inline-link" to={`/applications/${item.id}/formation`}>Данные формирования →</Link></p>}
        {item.status === 'COMPLETED' && item.decision && <div className={`decision decision-${item.decision.outcome.toLowerCase()}`}>
          <span className="decision-label">{item.decision.outcome === 'APPROVED' ? 'Одобрено'
            : item.decision.outcome === 'REVISION' ? 'Можно изменить условия' : 'Отказ'}</span>
          <h3>{item.decision.summary}</h3>
          {!!item.decision.reasons.length && <><h4>Причины решения</h4><ul>{item.decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></>}
          {!!item.decision.recommendations.length && <><h4>Что можно изменить</h4><ul>{item.decision.recommendations.map((tip) => <li key={tip}>{tip}</li>)}</ul></>}
          {item.decision.outcome === 'APPROVED' && <Link className="button" to={`/approved/${item.id}`}>Продолжить</Link>}
          {item.decision.outcome === 'REVISION' && <Link className="button" to="/calculator" state={{
            draft: { productId: item.productId, amount: item.decision.suggestedAmount ?? item.amount, months: item.months, purpose: item.purpose },
          }}>Заполнить заявку заново</Link>}
        </div>}
      </article>)
    )}
  </>;
}
