import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field } from '../components/Field';
import { api } from '../api';
import { errorMessage, profileError } from '../lib';
import { useSession } from '../session';
import type { Profile } from '../types';

const emptyProfile: Profile = {
  fullName: '', email: '', phone: '', passport: '',
  companyName: '', inn: '', industry: '', monthlyRevenue: 0,
};

export function DataPage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const { user, setUser } = useSession();

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setLoadFailed(false);
    api.getProfile().then((value) => { if (active) setProfile(value ?? emptyProfile); })
      .catch((err: unknown) => { if (active) { setError(errorMessage(err)); setLoadFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  function change<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((previous) => ({ ...previous, [key]: value })); setSaved(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaved(false);
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
        </section>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions"><button className="button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить данные'}</button>
          {saved && <><span className="success" role="status">Данные сохранены</span>
            <Link className="inline-link" to="/calculator">Перейти к подбору кредита →</Link></>}</div>
      </fieldset>
    </form>
  </>;
}
