export type WalletGroup =
  | 'cash'
  | 'bank'
  | 'ewallet'
  | 'emoney'
  | 'investment'
  | 'credit';

export type WalletKind = 'asset' | 'liability';

export type CategoryType = 'income' | 'expense' | 'saving';

export type TransactionType =
  | 'income'
  | 'expense'
  | 'saving'
  | 'saving_withdrawal'
  | 'transfer'
  | 'adjustment';

export type ThemePreference = 'dark' | 'light' | 'system';

export type PeriodPreset =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'this_year'
  | 'all';

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  cycleStartDay: number;
  timezone: string;
  theme: ThemePreference;
  privacyMode: boolean;
  onboardingCompleted: boolean;
}

export interface Wallet {
  id: string;
  name: string;
  group: WalletGroup;
  kind: WalletKind;
  openingBalance: number;
  openingDate: string; // YYYY-MM-DD
  icon: string;
  color: string;
  includeInTotal: boolean;
  hidden: boolean;
  archived: boolean;
  sortOrder: number;
}

export interface WalletValuation {
  id: string;
  walletId: string;
  date: string; // YYYY-MM-DD
  marketValue: number;
}

export interface Category {
  id: string;
  type: CategoryType;
  name: string;
  budgetCap: number | null; // null = no category cap (Interpretasi B)
  icon: string;
  color: string;
  archived: boolean;
  sortOrder: number;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  monthlyBudget: number | null; // null = track only (replaces Rp1)
  aliases: string[];
  defaultNotes: string[];
  archived: boolean;
  sortOrder: number;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  deadline: string | null; // YYYY-MM-DD
  walletId: string | null;
  subcategoryId: string | null;
  priority: number;
  color: string;
  isShared: boolean;
  status: 'active' | 'completed' | 'archived';
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  subcategoryId: string | null;
  walletId: string;
  toWalletId: string | null;
  amount: number; // positive integer IDR (adjustment may be negative)
  fee: number; // optional admin fee on transfer -> counted as Expense (Lainnya > Biaya)
  goalId: string | null;
  note: string;
  createdAt: string; // ISO timestamp
}

export interface QuickTemplate {
  id: string;
  label: string;
  type: TransactionType;
  amount: number;
  subcategoryId: string | null;
  walletId: string;
  toWalletId?: string | null;
  goalId?: string | null;
  note: string;
}

export interface AppDataset {
  profile: UserProfile;
  wallets: Wallet[];
  categories: Category[];
  subcategories: Subcategory[];
  goals: Goal[];
  transactions: Transaction[];
  valuations: WalletValuation[];
  templates: QuickTemplate[];
}

export interface WalletBalanceSummary {
  wallet: Wallet;
  costBasis: number; // openingBalance + inflow - outflow
  balance: number; // market value for investment if valuation exists, else costBasis
  unrealizedGain: number;
  unrealizedGainPct: number | null;
  lastValuationDate: string | null;
}

export interface PeriodSummary {
  income: number;
  expense: number;
  savingNet: number; // saving - saving_withdrawal
  netCashflow: number; // income - expense
  disposableLeft: number; // income - expense - savingNet
  savingsRate: number; // percentage 0..100+
  transferVolume: number;
  adjustmentNet: number;
}

export interface CategoryBudgetStatus {
  category: Category;
  effectiveBudget: number | null;
  subBudgetSum: number;
  hasSubOverflow: boolean; // true if subBudgetSum > budgetCap
  actual: number;
  pct: number | null;
  status: 'track' | 'safe' | 'warn' | 'over';
  subStatuses: {
    subcategory: Subcategory;
    actual: number;
    pct: number | null;
  }[];
}
