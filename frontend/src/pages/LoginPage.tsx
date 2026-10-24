import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Field } from '../components/Field';
import { api } from '../api';
import { errorMessage } from '../lib';
import { useSession } from '../session';

export function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useSession();
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const user = await api.login({ login: login.trim(), password });
      setUser(user); navigate('/data', { replace: true });
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <AuthLayout>
    <h2 className="auth-subtitle">Вход</h2>
    <form className="auth-form" onSubmit={submit}>
      <Field label="Логин" autoComplete="username" value={login} required maxLength={40}
        onChange={(event) => setLogin(event.target.value)} />
      <Field label="Пароль" type="password" autoComplete="current-password" required value={password}
        onChange={(event) => setPassword(event.target.value)} />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button button-black" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
      <Link className="text-link" to="/register">Регистрация</Link>
    </form>
  </AuthLayout>;
}
