import { describe, expect, it } from 'vitest';
import { monthlyPayment, passwordValid, profileError } from './lib';

describe('расчёт платежа', () => {
  it('считает аннуитет и нулевую ставку', () => {
    expect(monthlyPayment(1_000_000, 12, 12)).toBeCloseTo(88_848.79, 2);
    expect(monthlyPayment(120_000, 12, 0)).toBe(10_000);
    expect(monthlyPayment(100, 0, 10)).toBe(0);
  });
});
it('проверяет требование больше 8 символов и оба регистра', () => {
  expect(passwordValid('Abcdefgh')).toBe(false);
  expect(passwordValid('abcdefghi')).toBe(false);
  expect(passwordValid('ABCDEFGHI')).toBe(false);
  expect(passwordValid('Abcdefghi')).toBe(true);
});
it('отклоняет некорректные реквизиты и NaN выручку', () => {
  const profile = { fullName: 'Иван Иванов', email: 'test@example.com', phone: '+79991234567',
    passport: '1234 567890', companyName: 'ООО Тест', inn: '1234567890', industry: 'Торговля', monthlyRevenue: 500_000 };
  expect(profileError(profile)).toBeNull();
  expect(profileError({ ...profile, inn: '123' })).toMatch('ИНН');
  expect(profileError({ ...profile, monthlyRevenue: NaN })).toMatch('выручку');
});
