import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, useMocks } from '../api';
import { Field } from '../components/Field';
import { errorMessage, money, monthlyPayment } from '../lib';
import { useSession } from '../session';
import { purposes } from '../types';
import type { ApplicationDraft, LoanProduct, Purpose } from '../types';

export function CalculatorPage() {
  const { user } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const draft = (location.state as { draft?: ApplicationDraft } | null)?.draft;
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [productId, setProductId] = useState(draft?.productId ?? '');
  const [amount, setAmount] = useState(draft?.amount ?? 1_000_000);
  const [months, setMonths] = useState(draft?.months ?? 24);
  const [purpose, setPurpose] = useState<Purpose>(draft?.purpose ?? purposes[0]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.getProducts().then((items) => {
      if (!active) return;
      setProducts(items);
      setProductId((previous) => items.some((item) => item.id === previous) ? previous : items[0]?.id ?? '');
    }).catch((err: unknown) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const product = products.find((item) => item.id === productId);
  const valid = !!product && Number.isFinite(amount) && Number.isInteger(amount)
    && amount >= product.minAmount && amount <= product.maxAmount
    && Number.isInteger(months) && months >= product.minMonths && months <= product.maxMonths;
  const payment = valid && product ? monthlyPayment(amount, months, product.annualRate) : 0;

  function selectProduct(item: LoanProduct) {
    setProductId(item.id);
    setAmount((value) => Math.min(item.maxAmount, Math.max(item.minAmount, value)));
    setMonths((value) => Math.min(item.maxMonths, Math.max(item.minMonths, value)));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      await api.createApplication({ amount, months, purpose, productId });
      navigate('/applications');
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  if (!user?.profileComplete) return <Navigate to="/data" replace />;
  if (loading) return <p className="loading" role="status">Загружаем кредитные предложения…</p>;
  if (!product) return <div className="card"><p role="alert">{error || 'Кредитные предложения пока недоступны.'}</p>
    <button className="button" onClick={() => setAttempt(attempt + 1)}>Обновить</button></div>;

  return <>
    <div className="page-heading"><p className="eyebrow">Финансирование бизнеса</p>
      <h1>Кредит под ваши планы</h1><p>Выберите условия и узнайте предварительный платёж.</p></div>
    <form className="calculator card" onSubmit={submit}>
      <fieldset disabled={busy} className="calculator-controls">
        <legend className="sr-only">Параметры кредита</legend>
        <div className="product-list" role="group" aria-label="Кредитный продукт">
          {products.map((item) => <label key={item.id} className={`product ${item.id === productId ? 'selected' : ''}`}>
            <input type="radio" name="product" checked={item.id === productId} onChange={() => selectProduct(item)} />
            <span><strong>{item.name}</strong><small>{item.description}</small></span>
          </label>)}
        </div>
        <div className="slider-field">
          <Field label="Сумма кредита, ₽" type="number" min={product.minAmount} max={product.maxAmount} step={1}
            required value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
          <input aria-label="Сумма кредита — ползунок" type="range" min={product.minAmount} max={product.maxAmount}
            step={10_000} value={Math.min(product.maxAmount, Math.max(product.minAmount, amount))}
            onChange={(e) => setAmount(Number(e.target.value))} />
          <div className="range-labels"><span>{money(product.minAmount)}</span><span>{money(product.maxAmount)}</span></div>
        </div>
        <div className="slider-field">
          <Field label="Срок, месяцев" type="number" min={product.minMonths} max={product.maxMonths} step={1}
            required value={months || ''} onChange={(e) => setMonths(Number(e.target.value))} />
          <input aria-label="Срок кредита — ползунок" type="range" min={product.minMonths} max={product.maxMonths}
            value={Math.min(product.maxMonths, Math.max(product.minMonths, months))}
            onChange={(e) => setMonths(Number(e.target.value))} />
          <div className="range-labels"><span>{product.minMonths} мес.</span><span>{product.maxMonths} мес.</span></div>
        </div>
        <label className="field"><span>Цель кредита</span>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value as Purpose)}>
            {purposes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </fieldset>
      <aside className="calculation-summary">
        <p className="eyebrow">Предварительный расчёт</p>
        <p className="summary-label">Ежемесячный платёж</p>
        <output className="payment" aria-live="polite">{valid ? money(payment) : '—'}</output>
        <dl><div><dt>Ставка</dt><dd>{product.annualRate}% годовых</dd></div>
          <div><dt>Срок</dt><dd>{valid ? `${months} мес.` : '—'}</dd></div>
          <div><dt>Общая сумма выплат</dt><dd>{valid ? money(payment * months) : '—'}</dd></div></dl>
        <p className="hint">Расчёт аннуитетного платежа без комиссий и страховки.
          {useMocks && ' Условия и решения демонстрационные, не являются предложением банка.'}</p>
        {!valid && <p className="error">Укажите сумму и срок в допустимых пределах.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button" disabled={!valid || busy}>{busy ? 'Отправляем…' : 'Оставить заявку'}</button>
      </aside>
    </form>
  </>;
}
