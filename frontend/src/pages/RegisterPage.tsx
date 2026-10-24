import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Field } from '../components/Field';
import { api } from '../api';
import { errorMessage, loginPattern, passwordValid } from '../lib';
import { useSession } from '../session';

export function RegisterPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useSession();
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const normalized = login.trim();
    if (!loginPattern.test(normalized)) return setError('Логин: 3–40 латинских букв, цифры, _, . или -.');
    if (!passwordValid(password)) return setError('Пароль: минимум 9 символов, строчные и заглавные латинские буквы.');
    if (password !== repeat) return setError('Пароли не совпадают.');
    setBusy(true);
    try {
      if (!await api.loginAvailable(normalized)) throw new Error('Этот логин уже занят.');
      const user = await api.register({ login: normalized, password });
      setUser(user); navigate('/data', { replace: true });
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <AuthLayout>
    <h2 className="auth-subtitle">Регистрация</h2>
    <form className="auth-form" onSubmit={submit}>
      <Field label="Логин" autoComplete="username" required value={login} maxLength={40}
        onChange={(event) => setLogin(event.target.value)} />
      <Field label="Пароль" type="password" autoComplete="new-password" required value={password}
        aria-describedby="password-hint" onChange={(event) => setPassword(event.target.value)} />
      <p className="hint" id="password-hint">От 9 символов, строчные и заглавные латинские буквы.</p>
      <Field label="Повторите пароль" type="password" autoComplete="new-password" required value={repeat}
        onChange={(event) => setRepeat(event.target.value)} />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button button-black" disabled={busy}>{busy ? 'Создаём аккаунт…' : 'Зарегистрироваться'}</button>
      <Link className="text-link" to="/login">Уже есть аккаунт? Войти</Link>
    </form>
  </AuthLayout>;
}
