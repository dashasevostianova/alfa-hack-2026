import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formationDemo, formationRequest } from '../api/formation';
import type { FormationResult } from '../api/formation';
import { errorMessage, money } from '../lib';

const stages = [
  ['Формируем кредитную заявку', 'Проверяем выбранные параметры финансирования'],
  ['Получаем сведения о компании', 'Демонстрация запроса выписки из ЕГРЮЛ'],
  ['Проверяем данные ФНС', 'Демонстрация обращения к сервису «Прозрачный бизнес»'],
  ['Загружаем финансовую отчётность', 'Сопоставляем сведения о компании и подготавливаем финансовые показатели'],
];
const labels: Record<string, string> = { revenue: 'Выручка', net_profit: 'Чистая прибыль', current_loans: 'Расчётный взвешенный долг', tax_arrears: 'Синтетическая оценка возможной текущей просрочки', equity: 'Капитал', assets: 'Активы' };
export function FormationPage() {
  const { id } = useParams();
  const [stage, setStage] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FormationResult | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!formationDemo || !id) return;
    let active = true;
    setReady(false); setResult(null); setError(''); setStage(0); setLoading(true);
    const timers: ReturnType<typeof setTimeout>[] = [];
    async function load() {
      try {
        const existing = await formationRequest<FormationResult>(`/applications/${id}`);
        if (!active) return;
        if (existing.formationStatus !== 'DRAFT') {
          setResult(existing); setReady(true); setLoading(false);
          return;
        }
        setLoading(false);
        timers.push(...[600, 1300, 2000].map((ms, i) => setTimeout(() => { if (active) setStage(i + 1); }, ms)));
        timers.push(setTimeout(() => { if (active) setReady(true); }, 3000));
        const formed = await formationRequest<FormationResult>(`/applications/${id}/form`, {});
        if (active) setResult(formed);
      } catch (err) { if (active) { setError(errorMessage(err)); setLoading(false); } }
    }
    void load();
    return () => { active = false; timers.forEach(clearTimeout); };
  }, [id, attempt]);
  if (!formationDemo) return <p>Модуль демонстрации не включён.</p>;
  const done = ready && !!result && !error;
  const stored = result?.finances[0];
  return <>
    <div className="page-heading"><p className="eyebrow">Подготовка к рассмотрению</p>
      <h1>{done ? 'Формирование заявки завершено' : loading ? 'Данные заявки' : 'Формируем вашу заявку'}</h1>
      <p>Проверяем сведения о компании и подготавливаем данные для рассмотрения.</p></div>
    <section className="card formation" aria-busy={!done && !error}>
      <p className="hint">Проверки ЕГРЮЛ и ФНС выполняются в демонстрационном режиме.</p>
      {error ? <><h2>Не удалось сформировать заявку</h2><p className="error" role="alert">{error}</p>
        <button className="button" onClick={() => setAttempt(value => value + 1)}>Повторить попытку</button></> : done ? <>
        <div className="formation-check" aria-hidden="true">✓</div>
        <h2>Данные компании загружены</h2><p>Ваша заявка сохранена и доступна в личном кабинете. Текущий этап рассмотрения можно посмотреть во вкладке «Заявки».</p>
        <h3>{result.company.fullname}</h3>
        <p>ИНН {result.company.inn} · ОГРН {result.company.ogrn || 'не указан'} · ОКВЭД {result.company.okved} · {result.company.legal_form}</p>
        <p className="hint">{result.source === 'manual' ? 'Сведения заполнены вручную. Годовая выручка рассчитана по указанной месячной выручке.' : 'Сведения о компании загружены автоматически.'}</p>
        <dl className="formation-values">{Object.entries(labels).map(([key, label]) => {
          const value = key === 'equity' || key === 'assets' ? result.calculated[key] : stored?.[key as keyof typeof stored];
          return <div key={key}><dt>{result.source === 'manual' && key === 'current_loans' ? 'Текущие обязательства' : result.source === 'manual' && key === 'tax_arrears' ? 'Возможная текущая просрочка' : label}</dt><dd>{value == null ? 'Нет данных' : money(Number(value))}</dd></div>;
        })}</dl>
        <Link className="button" to="/applications">Перейти к заявкам</Link>
      </> : <div role="status" aria-live="polite">
        <div className="formation-spinner" aria-hidden="true" />
        <h2>{loading ? 'Загружаем сохранённые данные…' : stages[stage][0]}</h2><p>{loading ? 'Проверяем состояние заявки' : ready ? 'Ожидаем подтверждение сохранения от сервера…' : stages[stage][1]}</p>
        {!loading && <ol className="formation-stages">{stages.map(([label], index) => <li key={label} className={index <= stage ? 'active' : ''}>
          <span>{index < stage ? '✓' : index + 1}</span>{label}</li>)}</ol>}
      </div>}
    </section>
  </>;
}
