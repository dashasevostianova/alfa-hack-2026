import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { formationDemo, formationRequest } from '../api/formation';
import type { FormationResult } from '../api/formation';
import { buildModelFeatures, getModelDecision, predictApplication, saveModelDecision } from '../api/model';
import type { ModelDecision } from '../api/model';
import { persistModelDecision } from '../api/modelPersistence';
import { errorMessage, money } from '../lib';
import { useSession } from '../session';

const stages = [
  ['Формируем кредитную заявку', 'Проверяем выбранные параметры финансирования'],
  ['Получаем сведения о компании', 'Демонстрация запроса выписки из ЕГРЮЛ'],
  ['Проверяем данные ФНС', 'Демонстрация обращения к сервису «Прозрачный бизнес»'],
  ['Загружаем финансовую отчётность', 'Сопоставляем сведения о компании и подготавливаем финансовые показатели'],
];
const labels: Record<string, string> = { revenue: 'Выручка', net_profit: 'Чистая прибыль', current_loans: 'Расчётный взвешенный долг', tax_arrears: 'Синтетическая оценка возможной текущей просрочки', equity: 'Капитал', assets: 'Активы' };
export function FormationPage() {
  const { id } = useParams();
  const location = useLocation();
  const animate = Boolean((location.state as { animate?: boolean } | null)?.animate);
  const [stage, setStage] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FormationResult | null>(null);
  const [decision, setDecision] = useState<ModelDecision | FormationResult['decision']>(null);
  const [modelPrediction, setModelPrediction] = useState<0 | 1 | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { user } = useSession();
  const userId = user?.id;
  useEffect(() => {
    if (!formationDemo || !id || !userId) return;
    const applicationId = id;
    const currentUserId = userId;
    let active = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let finishWait: (() => void) | undefined;
    const wait = (ms: number) => new Promise<void>(resolve => {
      finishWait = resolve;
      timers.push(setTimeout(resolve, ms));
    });
    setReady(false); setResult(null); setDecision(null); setModelPrediction(null);
    setError(''); setStage(0); setLoading(true);
    async function load() {
      try {
        const existing = await formationRequest<FormationResult>(`/applications/${applicationId}`);
        if (!active) return;
        if (existing.decision) {
          setResult(existing);
          setLoading(false);
          setDecision(existing.decision);
          setReady(true);
          return;
        }
        const saved = getModelDecision(currentUserId, applicationId);
        if (saved) {
          setResult(existing);
          setLoading(false);
          const verified = await persistModelDecision(applicationId, saved.prediction);
          if (!active) return;
          setResult(verified);
          setDecision(saved);
          setModelPrediction(saved.prediction);
          setStage(3);
          setReady(true);
          return;
        }
        setLoading(false);
        if (animate) {
          timers.push(...[600, 1300, 2000].map((ms, index) =>
            setTimeout(() => { if (active) setStage(index + 1); }, ms)));
          await wait(3000);
          if (!active) return;
        }
        setResult(existing);
        // Give the collected information its own visible state before the verdict.
        await wait(300);
        if (!active) return;
        setStage(2);
        const features = buildModelFeatures(existing, existing);
        const prediction = await predictApplication(features);
        if (!active) return;
        const verified = await persistModelDecision(applicationId, prediction);
        if (!active) return;
        setResult(verified);
        const savedDecision = saveModelDecision(currentUserId, applicationId, prediction);
        setDecision(savedDecision);
        setModelPrediction(prediction);
        setStage(3);
        setReady(true);
      } catch (err) { if (active) { setError(errorMessage(err)); setLoading(false); } }
    }
    void load();
    return () => { active = false; timers.forEach(clearTimeout); finishWait?.(); };
  }, [id, attempt, userId, animate]);
  if (!formationDemo) return <p>Модуль демонстрации не включён.</p>;
  const done = ready && !!result && !error;
  const stored = result?.finances[0];
  return <>
    <div className="page-heading"><p className="eyebrow">Подготовка к рассмотрению</p>
      <h1>{done ? 'Оценка заявки завершена' : result ? 'Данные компании собраны' : 'Формируем вашу заявку'}</h1>
      <p>Собираем сведения о компании, затем передаём заявку модели оценки.</p></div>
    <section className="card formation" aria-busy={!done && !error}>
      {done && decision && <div className={`decision decision-${decision.outcome.toLowerCase()} formation-verdict`}>
        <div className={`formation-check${decision.outcome === 'APPROVED' ? '' : ' formation-check-rejected'}`} aria-hidden="true">
          {decision.outcome === 'APPROVED' ? '✓' : '×'}
        </div>
        <h2>Результат оценки</h2>
        <span className="decision-label">{decision.outcome === 'APPROVED' ? 'Одобрено' : 'Не одобрено'}</span>
        <p>{decision.summary}</p>
        {modelPrediction !== null && <p className="hint">Ответ модели: {modelPrediction}</p>}
        <p>Ваша заявка и результат оценки сохранены в личном кабинете.</p>
        {decision.outcome === 'APPROVED' && id && <Link className="button" to={`/approved/${id}`}>Продолжить</Link>}
      </div>}
      <p className="hint">Анимация сбора сведений демонстрационная. Данные компании и решение модели используются из сохранённой заявки и сервисов приложения.</p>
      {error ? <><h2>Не удалось сформировать заявку</h2><p className="error" role="alert">{error}</p>
        <button className="button" onClick={() => setAttempt(value => value + 1)}>Повторить попытку</button></> : null}
      {result ? <>
        <h2>Данные компании загружены</h2>
        {result.bankOfferName && <p><strong>{result.bankOfferName}</strong> · {result.annualRate}% годовых</p>}
        {result.rateWarning && <p className="hint">{result.rateWarning}</p>}
        <h3>{result.company.fullname}</h3>
        <p>ИНН {result.company.inn} · ОГРН {result.company.ogrn || 'не указан'} · ОКВЭД {result.company.okved} · {result.company.legal_form}</p>
        <p className="hint">{result.source === 'manual' ? 'Сведения заполнены вручную. Годовая выручка рассчитана по указанной месячной выручке.' : 'Сведения о компании загружены автоматически.'}</p>
        <dl className="formation-values">{Object.entries(labels).map(([key, label]) => {
          const value = key === 'equity' || key === 'assets' ? result.calculated[key] : stored?.[key as keyof typeof stored];
          return <div key={key}><dt>{result.source === 'manual' && key === 'current_loans' ? 'Текущие обязательства' : result.source === 'manual' && key === 'tax_arrears' ? 'Возможная текущая просрочка' : label}</dt><dd>{value == null ? 'Нет данных' : money(Number(value))}</dd></div>;
        })}</dl>
        {!!result.warnings.length && <div className="hint"><h3>Особенности исходных данных</h3><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
        {!done && !error && <div role="status" aria-live="polite">
          <div className="formation-spinner" aria-hidden="true" />
          <h2>Сведения собраны. Получаем решение модели…</h2>
          <p>Оцениваем заявку по собранным данным.</p>
        </div>}
        <Link className="inline-link formation-back-link" to="/applications">← Перейти к заявкам</Link>
      </> : !error && <div role="status" aria-live="polite">
        <div className="formation-spinner" aria-hidden="true" />
        <h2>{loading ? 'Загружаем сохранённые данные…' : stages[stage][0]}</h2><p>{loading ? 'Проверяем состояние заявки' : stages[stage][1]}</p>
        {!loading && <ol className="formation-stages">{stages.map(([label], index) => <li key={label} className={index <= stage ? 'active' : ''}>
          <span>{index < stage ? '✓' : index + 1}</span>{label}</li>)}</ol>}
      </div>}
    </section>
  </>;
}
