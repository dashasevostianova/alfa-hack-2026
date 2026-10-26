import { FormationPage } from './pages/FormationPage';
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import { errorMessage } from './lib';
import { SessionContext } from './session';
import type { User } from './types';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DataPage } from './pages/DataPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ApprovedPage } from './pages/ApprovedPage';
import { DocumentSigningPage } from './pages/DocumentSigningPage';
import { LoanIssuedPage } from './pages/LoanIssuedPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.me().then((value) => { if (active) setUser(value); })
      .catch((err: unknown) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);
  if (loading) return <main className="loading" role="status">Загружаем кабинет…</main>;
  if (error) return <main className="startup-error"><p role="alert">{error}</p>
    <button className="button" onClick={() => setAttempt(attempt + 1)}>Повторить</button></main>;
  return <SessionContext.Provider value={{ user, setUser }}><BrowserRouter><Routes>
    <Route path="/login" element={user ? <Navigate to="/data" replace /> : <LoginPage />} />
    <Route path="/register" element={user ? <Navigate to="/data" replace /> : <RegisterPage />} />
    <Route element={<Layout />}>
      <Route path="/data" element={<DataPage />} />
      <Route path="/calculator" element={<CalculatorPage />} />
      <Route path="/applications/:id/formation" element={<FormationPage />} />
      <Route path="/applications" element={<ApplicationsPage />} />
      <Route path="/approved/:id" element={<ApprovedPage />} />
      <Route path="/applications/:id/sign" element={<DocumentSigningPage />} />
      <Route path="/applications/:id/issued" element={<LoanIssuedPage />} />
    </Route>
    <Route path="*" element={<Navigate to={user ? '/data' : '/login'} replace />} />
  </Routes></BrowserRouter></SessionContext.Provider>;
}
