import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formationDemo, formationRequest } from '../api/formation';
import type { FormationResult } from '../api/formation';
import { buildModelFeatures, getModelDecision, predictApplication, saveModelDecision } from '../api/model';
import type { ModelDecision } from '../api/model';
import { errorMessage, money } from '../lib';
import { useSession } from '../session';

const stages = [
  ['Загружаем заявку', 'Получаем сохранённые данные компании и финансовые показатели'],
  ['Подготавливаем данные для модели', 'Рассчитываем возраст компании и кодируем параметры заявки'],
  ['Передаём заявку модели', 'Модель рассчитывает результат по восьми показателям'],
  ['Сохраняем результат', 'Решение сохранено в браузере для этой заявки'],
];
const labels: Record<string, string> = { revenue: 'Выручка', net_profit: 'Чистая прибыль', current_loans: 'Расчётный взвешенный долг', tax_arrears: 'Синтетическая оценка возможной текущей просрочки', equity: 'Капитал', assets: 'Активы' };
export function FormationPage() {
  const { id } = useParams();
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
    setReady(false); setResult(null); setDecision(null); setModelPrediction(null);
    setError(''); setStage(0); setLoading(true);
    async function load() {
      try {
        const existing = await formationRequest<FormationResult>(`/applications/${applicationId}`);
        if (!active) return;
        setResult(existing);
        setLoading(false);
        setStage(1);
        if (existing.decision) {
          setDecision(existing.decision);
          setReady(true);
          return;
        }
        const saved = getModelDecision(currentUserId, applicationId);
        if (saved) {
          setDecision(saved);
          setModelPrediction(saved.prediction);
          setStage(3);
          setReady(true);
          return;
        }
        setStage(2);
        const features = buildModelFeatures(existing, existing);
        const prediction = await predictApplication(features);
        if (!active) return;
        const savedDecision = saveModelDecision(currentUserId, applicationId, prediction);
        setDecision(savedDecision);
        setModelPrediction(prediction);
        setStage(3);
        setReady(true);
      } catch (err) { if (active) { setError(errorMessage(err)); setLoading(false); } }
    }
    void load();
    return () => { active = false; };
  }, [id, attempt, userId]);
  if (!formationDemo) return <p>Модуль демонстрации не включён.</p>;
  const done = ready && !!result && !error;
  const stored = result?.finances[0];
  return <>
    <div className="page-heading"><p className="eyebrow">Подготовка к рассмотрению</p>
      <h1>{done ? 'Оценка заявки завершена' : loading ? 'Данные заявки' : 'Обрабатываем заявку'}</h1>
      <p>Передаём сохранённые сведения компании и параметры кредита модели оценки.</p></div>
    <section className="card formation" aria-busy={!done && !error}>
      <p className="hint">Результат модели сохраняется в браузере и доступен в истории заявок на этом устройстве.</p>
      {error ? <><h2>Не удалось сформировать заявку</h2><p className="error" role="alert">{error}</p>
        <button className="button" onClick={() => setAttempt(value => value + 1)}>Повторить попытку</button></> : done ? <>
        <div className="formation-check" aria-hidden="true">✓</div>
        <h2>Результат оценки</h2>
        {decision && <div className={`decision decision-${decision.outcome.toLowerCase()}`}>
          <span className="decision-label">{decision.outcome === 'APPROVED' ? 'Одобрено' : 'Не одобрено'}</span>
          <p>{decision.summary}</p>
          {modelPrediction !== null && <p className="hint">Ответ модели: {modelPrediction}</p>}
          {decision.outcome === 'APPROVED' && id && <Link className="button" to={`/approved/${id}`}>Продолжить</Link>}
        </div>}
        <p>Ваша заявка сохранена в личном кабинете. Результат оценки хранится в браузере и доступен во вкладке «Заявки» на этом устройстве.</p>
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
        <Link className="button" to="/applications">Перейти к заявкам</Link>
      </> : <div role="status" aria-live="polite">
        <div className="formation-spinner" aria-hidden="true" />
        <h2>{stages[stage][0]}</h2><p>{stages[stage][1]}</p>
        <ol className="formation-stages">{stages.map(([label], index) => <li key={label} className={index <= stage ? 'active' : ''}>
          <span>{index < stage ? '✓' : index + 1}</span>{label}</li>)}</ol>
      </div>}
    </section>
  </>;
}
