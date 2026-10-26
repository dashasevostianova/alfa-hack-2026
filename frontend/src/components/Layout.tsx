import { useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { api, useMocks } from '../api';
import { errorMessage } from '../lib';
import { useSession } from '../session';

export function Layout() {
  const { user, setUser } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user) return <Navigate to="/login" replace />;
  async function logout() {
    setBusy(true); setError('');
    try {
      await api.logout(); setUser(null); navigate('/login', { replace: true });
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return (
    <div className="cabinet">
      <header className="header">
        <NavLink className="brand" to="/data" aria-label="Альфа — личный кабинет">А</NavLink>
        <nav aria-label="Разделы кабинета">
          <NavLink to="/data">Данные</NavLink>
          {user.profileComplete ? <NavLink to="/calculator">Подбор кредита</NavLink>
            : <span className="nav-disabled" title="Сначала сохраните данные" aria-disabled="true">Подбор кредита</span>}
          <NavLink to="/applications">Заявки</NavLink>
        </nav>
        <button className="logout" disabled={busy} onClick={logout}>{busy ? 'Выходим…' : 'Выйти ↗'}</button>
      </header>
      {error && <p className="header-error" role="alert">{error}</p>}
      <main className="surface"><div className="content"><Outlet /></div></main>
      <footer className="cabinet-footer">
        Учебный проект{useMocks && ' · Моковые данные и решения · Используйте только вымышленные данные'}
      </footer>
    </div>
  );
}
