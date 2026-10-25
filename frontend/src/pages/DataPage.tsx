import { formationDemo, formationRequest } from '../api/formation';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field } from '../components/Field';
import { api } from '../api';
import { errorMessage, profileError } from '../lib';
import { useSession } from '../session';
import type { ManualBusiness, ManualFinances, Profile } from '../types';

const emptyProfile: Profile = {
  fullName: '', email: '', phone: '', passport: '',
  companyName: '', inn: '', industry: '', monthlyRevenue: 0,
};

const emptyBusiness: ManualBusiness = { legalForm: 'OOO', ogrn: '', registrationDate: '', okved: '', status: 'ACTIVE' };
const emptyFinances: ManualFinances = { netProfit: '', currentLoans: '', taxArrears: '', equity: '', assets: '' };

export function DataPage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [lookup, setLookup] = useState<{ inn: string; status: 'found' | 'missing' | 'loading' | 'error'; message?: string }>({ inn: '', status: 'loading' });
  const manual = formationDemo && lookup.inn === profile.inn && lookup.status === 'missing';
  const business = profile.manualBusiness ?? emptyBusiness;
  const finances = profile.manualFinances ?? emptyFinances;
  const autofilled = useRef<{ industry?: string; monthlyRevenue?: number }>({});
  const { user, setUser } = useSession();

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setLoadFailed(false);
    api.getProfile().then((value) => { if (active) setProfile(value ?? emptyProfile); })
      .catch((err: unknown) => { if (active) { setError(errorMessage(err)); setLoadFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!formationDemo || loading || loadFailed || busy || !/^(?:\d{10}|\d{12})$/.test(profile.inn)) return;
    let active = true;
    const inn = profile.inn;
    setLookup({ inn, status: 'loading' });
    const timeout = setTimeout(() => {
      formationRequest<{ found: boolean; okved: string; calculated: { revenue: string } }>(`/companies/${encodeURIComponent(inn)}`)
        .then(company => {
          if (!active) return;
          setLookup({ inn, status: company.found ? 'found' : 'missing' });
          if (!company.found) {
            const old = autofilled.current;
            autofilled.current = {};
            setProfile(previous => previous.inn !== inn ? previous : ({ ...previous,
              industry: previous.industry === old.industry ? '' : previous.industry,
              monthlyRevenue: previous.monthlyRevenue === old.monthlyRevenue ? 0 : previous.monthlyRevenue,
            }));
            return;
          }
          setProfile(previous => {
            if (previous.inn !== inn) return previous;
            const next = { ...previous };
            if (!previous.industry.trim() || previous.industry === autofilled.current.industry) {
              next.industry = company.okved;
              autofilled.current.industry = company.okved;
            }
            const revenue = Math.round(Number(company.calculated.revenue) / 12);
            if (Number.isFinite(revenue) && (previous.monthlyRevenue === 0 || previous.monthlyRevenue === autofilled.current.monthlyRevenue)) {
              next.monthlyRevenue = revenue;
              autofilled.current.monthlyRevenue = revenue;
            }
            return next.industry === previous.industry && next.monthlyRevenue === previous.monthlyRevenue ? previous : next;
          });
        })
        .catch(err => { if (active) setLookup({ inn, status: 'error', message: errorMessage(err) }); });
    }, 400);
    return () => { active = false; clearTimeout(timeout); };
  }, [profile.inn, loading, loadFailed, busy, lookupAttempt]);

  function change<K extends keyof Profile>(key: K, value: Profile[K]) {
    if (key === 'industry') delete autofilled.current.industry;
    if (key === 'monthlyRevenue') delete autofilled.current.monthlyRevenue;
    setProfile((previous) => ({ ...previous, [key]: value })); setSaved(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaved(false);
    if (formationDemo && (lookup.inn !== profile.inn || lookup.status === 'loading')) return setError('Дождитесь проверки ИНН.');
    if (formationDemo && lookup.status === 'error') return setError(lookup.message || 'Не удалось проверить ИНН.');
    if (manual && finances.netProfit.trim() === '') return setError('Укажите чистую прибыль за год, включая нулевую или отрицательную.');
    const validation = profileError(profile);
    if (validation) return setError(validation);
    setBusy(true);
    try {
      setProfile(await api.saveProfile(profile));
      if (user) setUser({ ...user, profileComplete: true });
      setSaved(true);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  if (loading) return <p className="loading" role="status">Загружаем данные…</p>;
  if (loadFailed) return <div className="card"><p className="error" role="alert">{error}</p>
    <button className="button" onClick={() => setAttempt(attempt + 1)}>Повторить загрузку</button></div>;

  return <>
    <div className="page-heading"><p className="eyebrow">Личный кабинет</p><h1>Данные о вас и бизнесе</h1>
      <p>Заполните анкету, чтобы перейти к подбору кредита.</p></div>
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <section className="card">
          <div className="section-title"><span className="section-number">01</span><h2>Личные данные</h2></div>
          <div className="field-grid">
            <Field label="ФИО" autoComplete="name" required value={profile.fullName} onChange={(e) => change('fullName', e.target.value)} />
            <Field label="Электронная почта" type="email" autoComplete="email" required value={profile.email} onChange={(e) => change('email', e.target.value)} />
            <Field label="Телефон" type="tel" autoComplete="tel" required placeholder="+7 999 123-45-67" value={profile.phone} onChange={(e) => change('phone', e.target.value)} />
            <Field label="Серия и номер паспорта" inputMode="numeric" required placeholder="1234 567890" maxLength={11} value={profile.passport} onChange={(e) => change('passport', e.target.value)} />
          </div>
        </section>
        <section className="card">
          <div className="section-title"><span className="section-number">02</span><h2>Данные бизнеса</h2></div>
          <div className="field-grid">
            <Field label="Название компании / ИП" required value={profile.companyName} onChange={(e) => change('companyName', e.target.value)} />
            <Field label="ИНН" inputMode="numeric" required minLength={10} maxLength={12} value={profile.inn} onChange={(e) => change('inn', e.target.value)} />
            <Field label="Сфера деятельности" required placeholder="Например, розничная торговля" value={profile.industry} onChange={(e) => change('industry', e.target.value)} />
            <Field label="Месячная выручка, ₽" type="number" min={1} step={1} required value={profile.monthlyRevenue || ''} onChange={(e) => change('monthlyRevenue', Number(e.target.value))} />
          </div>
          {formationDemo && lookup.inn === profile.inn && lookup.status === 'loading' && <p className="hint" role="status">Проверяем сведения о компании…</p>}
          {formationDemo && lookup.inn === profile.inn && lookup.status === 'error' && <p className="error" role="alert">{lookup.message}
            {' '}<button type="button" className="inline-link" onClick={() => setLookupAttempt(value => value + 1)}>Повторить проверку</button></p>}
        </section>
        {manual && <section className="card">
          <div className="section-title"><span className="section-number">03</span><h2>Сведения для заявки</h2></div>
          <p className="muted">Сведения о компании не найдены. Заполните реквизиты и финансовые показатели вручную. Все суммы указываются в рублях.</p>
          <div className="field-grid">
            <label className="field"><span>Юридическая форма</span><select value={business.legalForm}
              onChange={event => change('manualBusiness', { ...business, legalForm: event.target.value as ManualBusiness['legalForm'] })}>
              <option value="OOO">ООО</option><option value="IP">ИП</option></select></label>
            <Field label="Дата регистрации" type="date" required max={new Date().toLocaleDateString('en-CA')}
              value={business.registrationDate} onChange={event => change('manualBusiness', { ...business, registrationDate: event.target.value })} />
            <Field label="ОКВЭД" required placeholder="62.01" maxLength={10} value={business.okved}
              onChange={event => change('manualBusiness', { ...business, okved: event.target.value })} />
            <Field label="ОГРН / ОГРНИП (если известен)" inputMode="numeric" maxLength={15} value={business.ogrn}
              onChange={event => change('manualBusiness', { ...business, ogrn: event.target.value })} />
            <label className="field"><span>Статус компании</span><select value={business.status}
              onChange={event => change('manualBusiness', { ...business, status: event.target.value as ManualBusiness['status'] })}>
              <option value="ACTIVE">Действующая</option><option value="LIQUIDATED">Ликвидирована</option><option value="BANKRUPT">Банкротство</option></select></label>
            <Field label="Чистая прибыль за год, ₽" type="number" step={1} required value={finances.netProfit}
              onChange={event => change('manualFinances', { ...finances, netProfit: event.target.value })} />
            <Field label="Текущие обязательства, ₽ (если известны)" type="number" min={0} step={1} value={finances.currentLoans}
              onChange={event => change('manualFinances', { ...finances, currentLoans: event.target.value })} />
            <Field label="Возможная текущая просрочка, ₽ (если известна)" type="number" min={0} step={1} value={finances.taxArrears}
              onChange={event => change('manualFinances', { ...finances, taxArrears: event.target.value })} />
            <Field label="Капитал, ₽ (если известен)" type="number" step={1} value={finances.equity}
              onChange={event => change('manualFinances', { ...finances, equity: event.target.value })} />
            <Field label="Активы, ₽ (если известны)" type="number" min={0} step={1} value={finances.assets}
              onChange={event => change('manualFinances', { ...finances, assets: event.target.value })} />
          </div>
          <p className="hint">Годовая выручка рассчитывается как указанная месячная выручка × 12. Неизвестные необязательные показатели оставьте пустыми.</p>
        </section>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions"><button className="button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить данные'}</button>
          {saved && <><span className="success" role="status">Данные сохранены</span>
            <Link className="inline-link" to="/calculator">Перейти к подбору кредита →</Link></>}</div>
      </fieldset>
    </form>
  </>;
}
