import type { Profile } from './types';

export const money = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  }).format(value);

export function monthlyPayment(amount: number, months: number, annualRate: number) {
  if (amount <= 0 || months <= 0) return 0;
  const rate = annualRate / 100 / 12;
  return rate === 0 ? amount / months : amount * rate / (1 - (1 + rate) ** -months);
}

export const loginPattern = /^[a-zA-Z0-9_.-]{3,40}$/;
export const passwordValid = (value: string) =>
  value.length >= 9 && /[a-z]/.test(value) && /[A-Z]/.test(value);

export function profileError(profile: Profile): string | null {
  if (profile.fullName.trim().split(/\s+/).length < 2) return 'Укажите фамилию и имя.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return 'Проверьте адрес почты.';
  if (!/^\+?[\d\s()-]{10,20}$/.test(profile.phone)
    || profile.phone.replace(/\D/g, '').length < 10) return 'Проверьте номер телефона.';
  if (!/^\d{10}$/.test(profile.passport.replace(/\s/g, ''))) return 'Паспорт: 4 цифры серии и 6 цифр номера.';
  if (!profile.companyName.trim()) return 'Укажите название компании.';
  if (!/^(?:\d{10}|\d{12})$/.test(profile.inn)) return 'ИНН должен содержать 10 или 12 цифр.';
  if (!profile.industry.trim()) return 'Укажите сферу деятельности.';
  if (!Number.isFinite(profile.monthlyRevenue) || profile.monthlyRevenue <= 0) {
    return 'Укажите положительную месячную выручку.';
  }
  return null;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.';
