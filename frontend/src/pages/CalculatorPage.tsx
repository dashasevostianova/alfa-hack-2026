import { formationDemo, getQuote } from '../api/formation';
import type { RateQuote } from '../api/formation';
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
  const [collateral, setCollateral] = useState(draft?.collateral ?? false);
  const [bankOfferId, setBankOfferId] = useState(draft?.bankOfferId ?? '');
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  useEffect(() => {
    if (!formationDemo || !user?.profileComplete) return;
    let active = true;
    setQuote(null); setQuoteError('');
    setQuoteLoading(true);
    const timer = setTimeout(() => {
      getQuote(collateral).then((result) => { if (active) {
        setQuote(result);
        setBankOfferId(previous => result.offers.some(offer => offer.id === previous && offer.annualRate != null) ? previous : '');
      } })
        .catch((err: unknown) => { if (active) setQuoteError(errorMessage(err)); })
        .finally(() => { if (active) setQuoteLoading(false); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [collateral, quoteAttempt, user?.profileComplete]);

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
  const bankOffer = quote?.offers.find(offer => offer.id === bankOfferId);
  const annualRate = formationDemo ? bankOffer?.annualRate : product?.annualRate;
  const rateReady = !formationDemo || (!!quote && !quoteLoading && quote.collateral === collateral && bankOffer?.annualRate != null);
  const payment = valid && rateReady && annualRate != null ? monthlyPayment(amount, months, annualRate) : 0;

  function selectProduct(item: LoanProduct) {
    setProductId(item.id);
    setAmount((value) => Math.min(item.maxAmount, Math.max(item.minAmount, value)));
    setMonths((value) => Math.min(item.maxMonths, Math.max(item.minMonths, value)));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || !rateReady || busy) return;
    setBusy(true); setError('');
    try {
      const application = await api.createApplication({ amount, months, purpose, productId, collateral, annualRate, bankOfferId });
      navigate(formationDemo ? `/applications/${application.id}/formation` : '/applications', { state: { animate: true } });
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
        {formationDemo && <label className="field"><span>Обеспечение кредита</span>
          <select value={String(collateral)} onChange={(event) => setCollateral(event.target.value === 'true')}>
            <option value="false">Без залога</option><option value="true">С залогом</option>
          </select>
        </label>}
        {formationDemo && quote && !quoteLoading && quote.collateral === collateral && <>
          <p className="hint">{quote.legalForm === 'IP' ? 'ИП' : 'ООО'} · Возраст бизнеса: {quote.businessAgeMonths} мес. ({quote.businessAgeBucket.toLowerCase()}). Определён по дате регистрации, отдельно от срока кредита.</p>
          <label className="field"><span>Предложение банка</span>
            <select required value={bankOfferId} onChange={event => setBankOfferId(event.target.value)}>
              <option value="">Выберите предложение</option>
              {quote.offers.map(offer => <option key={offer.id} value={offer.id} disabled={offer.annualRate == null}>
                {offer.name} — {offer.annualRate != null ? `${offer.annualRate}% годовых` : offer.ratePercent != null ? `${offer.ratePercent}% ${offer.rateUnit === 'monthly_overpayment' ? 'переплата в месяц' : 'в месяц'}` : 'годовая ставка не опубликована'}
              </option>)}
            </select>
          </label>
          {bankOffer?.detailsUrl && <p className="hint"><a className="inline-link" href={bankOffer.detailsUrl} target="_blank" rel="noreferrer">Условия выбранного предложения ↗</a></p>}
          {!!quote.offers.filter(offer => offer.annualRate == null).length && <p className="hint">Предложения без опубликованной годовой ставки показаны для справки. Расчёт и подача по ним недоступны: месячная переплата и грейс-период не заменяют годовую ставку.</p>}
        </>}
        <label className="field"><span>Цель кредита</span>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value as Purpose)}>
            {purposes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </fieldset>
      <aside className="calculation-summary">
        <p className="eyebrow">Предварительный расчёт</p>
        <p className="summary-label">Ежемесячный платёж</p>
        <output className="payment" aria-live="polite">{valid && rateReady ? money(payment) : '—'}</output>
        <dl><div><dt>Ставка</dt><dd>{rateReady && annualRate != null ? `${annualRate}% годовых` : '—'}</dd></div>
          <div><dt>Срок</dt><dd>{valid ? `${months} мес.` : '—'}</dd></div>
          <div><dt>Общая сумма выплат</dt><dd>{valid && rateReady ? money(payment * months) : '—'}</dd></div></dl>
        <p className="hint">Расчёт аннуитетного платежа без комиссий и страховки.
          {formationDemo && bankOffer && /линия|овердрафт/i.test(bankOffer.name) && ' Для кредитной линии и овердрафта это условная оценка; фактический график отличается.'}
          {useMocks && ' Условия и решения демонстрационные, не являются предложением банка.'}</p>
        {quoteLoading && <p className="hint" role="status">Загружаем ставки с калькулятора банка. Запрос может занять до 3 минут.</p>}
        {quoteError && <p className="error" role="alert">{quoteError} <button type="button" className="inline-link"
          onClick={() => setQuoteAttempt((value) => value + 1)}>Повторить</button></p>}
        {quote && !quoteLoading && <p className="hint">Ставка получена {new Date(quote.fetchedAt).toLocaleTimeString('ru-RU')}.
          {' '}<a href={quote.source} target="_blank" rel="noreferrer">Источник</a>. Окончательные условия определяет банк.{' '}<button type="button" className="inline-link" onClick={() => setQuoteAttempt(value => value + 1)}>Обновить расчёт</button></p>}
        {formationDemo && quote && !quoteLoading && !quoteError && !bankOffer && <p className="hint">Выберите предложение с годовой ставкой для расчёта платежа.</p>}
        {!valid && <p className="error">Укажите сумму и срок в допустимых пределах.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button" disabled={!valid || !rateReady || busy}>{busy ? 'Отправляем…' : 'Оставить заявку'}</button>
      </aside>
    </form>
  </>;
}
