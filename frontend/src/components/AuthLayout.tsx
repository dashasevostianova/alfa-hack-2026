import type { ReactNode } from 'react';
import { useMocks } from '../api';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <span className="brand auth-brand" aria-label="Альфа">А</span>
      <div className="auth-content">
        <h1>Альфа-Бизнес</h1>
        <p className="auth-caption">Личный кабинет предпринимателя</p>
        {children}
      </div>
      <p className="auth-footer">Учебный проект · {useMocks ? 'Демо: используйте только вымышленные данные' : 'Платформа для бизнеса'}</p>
    </main>
  );
}
