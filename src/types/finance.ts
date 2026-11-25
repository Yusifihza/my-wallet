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
  | `month:${string}`
  | 'last_3_months'
  | 'this_year'
  | 'all';

export type InvestmentAssetClass =
  | 'pu'
  | 'obligasi'
  | 'reksa_saham'
  | 'saham'
  | 'sbn'
  | 'emas'
  | 'campuran'
  | 'lainnya';

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
  isDemoData?: boolean;
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

export interface InvestmentProduct {
  id: string;
  ownerId?: string;
  walletId: string;
  goalId: string | null; // e.g., goal_wedding or null (personal)
  name: string; // e.g., Pasar Uang (PU), Obligasi, Reksa Saham, Saham, SBN
  assetClass: InvestmentAssetClass;
  investedAmount: number; // total principal deposited (modal setor)
  marketValue: number; // current market value (nilai pasar)
  color: string;
  updatedAt: string; // YYYY-MM-DD
  sortOrder: number;
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
  ownerId?: string;
  sharedRole?: 'owner' | 'member';
  ownerName?: string;
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

export interface GoalContribution {
  id: string;
  goalId: string;
  contributorUserId?: string | null;
  contributorName: string;
  isPartner: boolean;
  amount: number;
  date: string; // YYYY-MM-DD
  productName?: string; // e.g. Pasar Uang (PU), Obligasi, SBN
  note: string;
}

export interface SharedGoalPeerData {
  goalId: string;
  ownerId: string;
  ownerName: string;
  memberId: string | null;
  memberName: string | null;
  sharePercent: number;
  viewerRole: 'owner' | 'member';
  /** Bibit products linked to this goal owned by the OTHER person (never mixed into personal Net Worth) */
  peerProducts: InvestmentProduct[];
  /** Non-product saving tx net total logged by the OTHER person */
  peerTxSaved: number;
}

export interface GoalInvite {
  goalId: string;
  code: string;
  partnerName: string;
  partnerEmail: string;
  sharePercent: number; // partner target share 0..100
  status: 'pending' | 'joined';
}

export interface RecurringRule {
  id: string;
  label: string;
  type: 'income' | 'expense' | 'saving' | 'transfer';
  amount: number;
  subcategoryId: string | null;
  walletId: string;
  toWalletId: string | null;
  goalId: string | null;
  investmentProductId?: string | null;
  note: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfMonth: number; // 1..28
  nextRun: string; // YYYY-MM-DD
  active: boolean;
}

export interface AIFeedbackEntry {
  id: string;
  topic: string;
  vote: 'up' | 'down';
  note: string;
  createdAt: string;
}

export interface AIMemory {
  patterns: string[];
  preferences: Record<string, string>;
  feedbackLog: AIFeedbackEntry[];
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  topic?: string;
  feedback?: 'up' | 'down';
  createdAt: string;
}

export interface SheetsSyncConfig {
  status: 'disconnected' | 'connected';
  spreadsheetId: string;
  spreadsheetUrl: string;
  autoSync: boolean;
  lastSyncedAt: string | null;
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
  investmentProductId?: string | null; // optional Bibit product tagged on saving/withdrawal
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
  investmentProductId?: string | null;
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
  investmentProducts: InvestmentProduct[];
  goalContributions: GoalContribution[];
  goalInvites: GoalInvite[];
  sharedGoalPeers?: Record<string, SharedGoalPeerData>;
  recurringRules: RecurringRule[];
  aiMemory: AIMemory;
  sheetsSync: SheetsSyncConfig;
  templates: QuickTemplate[];
}

export interface WalletBalanceSummary {
  wallet: Wallet;
  costBasis: number; // openingBalance + inflow - outflow (or sum of product invested)
  balance: number; // market value for investment if valuation/products exist, else costBasis
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
