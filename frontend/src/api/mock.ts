import type {
  Api, ApplicationDraft, Credentials, Decision, LoanApplication, LoanProduct, Profile, User,
} from '../types';
import { loginPattern, passwordValid, profileError, } from '../lib';
import { purposes } from '../types';

export const MOCK_KEY = 'alpha-hackathon-demo-v1';
const SESSION_KEY = 'alpha-hackathon-session-v1';

interface Account {
  user: User;
  passwordHash: string;
  profile: Profile | null;
  applications: LoanApplication[];
}
interface Database { accounts: Account[] }

// Только демонстрация. Эти условия не являются предложением банка.
const products: LoanProduct[] = [
  { id: 'working-capital', name: 'На оборотные средства', description: 'Для ежедневных задач бизнеса',
    annualRate: 22, minAmount: 100_000, maxAmount: 10_000_000, minMonths: 6, maxMonths: 60 },
  { id: 'business-growth', name: 'На развитие', description: 'Для оборудования и новых направлений',
    annualRate: 20, minAmount: 300_000, maxAmount: 15_000_000, minMonths: 12, maxMonths: 84 },
];

function readDb(): Database {
  const raw = localStorage.getItem(MOCK_KEY);
  return raw ? JSON.parse(raw) as Database : { accounts: [] };
}
function writeDb(db: Database) {
  localStorage.setItem(MOCK_KEY, JSON.stringify(db));
}
function current(db: Database): Account {
  const id = sessionStorage.getItem(SESSION_KEY);
  const account = db.accounts.find((item) => item.user.id === id);
  if (!account) throw new Error('Сессия завершена. Войдите снова.');
  return account;
}
async function hash(password: string) {
  // Демо-хеш предотвращает хранение открытого пароля. Реальное хеширование — на Spring Boot.
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function validateCredentials({ login, password }: Credentials) {
  if (!loginPattern.test(login)) throw new Error('Логин: 3–40 латинских букв, цифры, _, . или -.');
  if (!passwordValid(password)) throw new Error('Пароль: минимум 9 символов, строчные и заглавные латинские буквы.');
}

export function demoDecision(amount: number): Decision {
  if (amount <= 2_000_000) {
    return { outcome: 'APPROVED', summary: 'Ваша заявка одобрена.', reasons: [], recommendations: [] };
  }
  if (amount <= 5_000_000) {
    return {
      outcome: 'REVISION', summary: 'Текущая заявка не одобрена. Можно изменить условия и подать новую.',
      reasons: ['Запрошенная сумма превышает демонстрационный лимит.'],
      recommendations: ['Уменьшите сумму до 2 000 000 ₽ и подайте новую заявку.'],
      suggestedAmount: 2_000_000,
    };
  }
  return {
    outcome: 'REJECTED', summary: 'По заявке принято отрицательное решение.',
    reasons: ['Сумма существенно превышает демонстрационный лимит.', 'Расчётная долговая нагрузка слишком велика.'],
    recommendations: ['Пересмотрите объём финансирования и показатели бизнеса.'],
  };
}

export function progressApplication(application: LoanApplication, now = Date.now()): LoanApplication {
  const seconds = (now - Date.parse(application.createdAt)) / 1000;
  const status = seconds < 5 ? 'SUBMITTED' : seconds < 10 ? 'VERIFICATION' : seconds < 15 ? 'REVIEW' : 'COMPLETED';
  return { ...application, status, decision: status === 'COMPLETED' ? demoDecision(application.amount) : null };
}

export const mockApi: Api = {
  async me() {
    const db = readDb();
    return db.accounts.find((item) => item.user.id === sessionStorage.getItem(SESSION_KEY))?.user ?? null;
  },
  async login({ login, password }) {
    const digest = await hash(password);
    const account = readDb().accounts.find((item) => item.user.login === login && item.passwordHash === digest);
    if (!account) throw new Error('Неверный логин или пароль.');
    sessionStorage.setItem(SESSION_KEY, account.user.id);
    return account.user;
  },
  async register(credentials) {
    validateCredentials(credentials);
    const digest = await hash(credentials.password);
    const db = readDb();
    if (db.accounts.some((item) => item.user.login === credentials.login)) throw new Error('Этот логин уже занят.');
    const user = { id: crypto.randomUUID(), login: credentials.login, profileComplete: false };
    db.accounts.push({ user, passwordHash: digest, profile: null, applications: [] });
    writeDb(db);
    sessionStorage.setItem(SESSION_KEY, user.id);
    return user;
  },
  async logout() { sessionStorage.removeItem(SESSION_KEY); },
  async loginAvailable(login) {
    return !readDb().accounts.some((item) => item.user.login === login);
  },
  async getProfile() { return current(readDb()).profile; },
  async saveProfile(profile) {
    const error = profileError(profile);
    if (error) throw new Error(error);
    const db = readDb();
    const account = current(db);
    account.profile = profile;
    account.user.profileComplete = true;
    writeDb(db);
    return profile;
  },
  async getProducts() { current(readDb()); return products; },
  async getApplications() {
    const db = readDb();
    const account = current(db);
    account.applications = account.applications.map((item) => progressApplication(item));
    writeDb(db);
    return account.applications;
  },
  async createApplication(draft: ApplicationDraft) {
    const db = readDb();
    const account = current(db);
    if (!account.user.profileComplete) throw new Error('Сначала сохраните личные данные и данные бизнеса.');
    const product = products.find((item) => item.id === draft.productId);
    if (!product || !Number.isFinite(draft.amount)
      || draft.amount < product.minAmount || draft.amount > product.maxAmount
      || !Number.isInteger(draft.months) || draft.months < product.minMonths
      || draft.months > product.maxMonths || !purposes.includes(draft.purpose)) {
      throw new Error('Проверьте параметры кредита.');
    }
    const application: LoanApplication = {
      ...draft, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
      productName: product.name, annualRate: product.annualRate, status: 'SUBMITTED', decision: null,
    };
    account.applications.unshift(application);
    writeDb(db);
    return application;
  },
};
