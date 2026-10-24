export interface Credentials {
  login: string;
  password: string;
}

export interface User {
  id: string;
  login: string;
  profileComplete: boolean;
}

// TODO: согласовать окончательный состав персональных и бизнес-данных.
export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  passport: string;
  companyName: string;
  inn: string;
  industry: string;
  monthlyRevenue: number;
}

export interface LoanProduct {
  id: string;
  name: string;
  description: string;
  annualRate: number;
  minAmount: number;
  maxAmount: number;
  minMonths: number;
  maxMonths: number;
}

export const purposes = [
  'Пополнение оборотных средств',
  'Покупка оборудования',
  'Развитие бизнеса',
  'Ремонт помещения',
] as const;

export type Purpose = (typeof purposes)[number];

export interface ApplicationDraft {
  amount: number;
  months: number;
  purpose: Purpose;
  productId: string;
}

export type ApplicationStatus = 'SUBMITTED' | 'VERIFICATION' | 'REVIEW' | 'COMPLETED';

export interface Decision {
  outcome: 'APPROVED' | 'REJECTED' | 'REVISION';
  summary: string;
  reasons: string[];
  recommendations: string[];
  suggestedAmount?: number;
}

export interface LoanApplication extends ApplicationDraft {
  id: string;
  createdAt: string;
  productName: string;
  annualRate: number;
  status: ApplicationStatus;
  decision: Decision | null;
}

export interface Api {
  me(): Promise<User | null>;
  login(credentials: Credentials): Promise<User>;
  register(credentials: Credentials): Promise<User>;
  logout(): Promise<void>;
  loginAvailable(login: string): Promise<boolean>;
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<Profile>;
  getProducts(): Promise<LoanProduct[]>;
  getApplications(): Promise<LoanApplication[]>;
  createApplication(draft: ApplicationDraft): Promise<LoanApplication>;
}
