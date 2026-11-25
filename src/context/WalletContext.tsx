'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { applyThreeMonthDummyData, clearDummyData } from '@/lib/dummyData';
import {
  advanceRecurringDate,
  calculateNetWorth,
  calculatePeriodSummary,
  calculateWalletBalances,
  filterTransactionsByRange,
  formatIDR,
  generateInviteCode,
  getPeriodRange,
} from '@/lib/finance';
import { createInitialDataset, todayISO } from '@/lib/seed';
import {
  generateUUID,
  isLocalModeOptedIn,
  joinSharedGoalByCode,
  leaveSharedGoalById,
  loadLocalDataset,
  loadSupabaseDataset,
  mapContributionToDb,
  mapGoalToDb,
  mapInviteToDb,
  mapProductToDb,
  mapRecurringToDb,
  mapTxToDb,
  mapWalletToDb,
  resetLocalDataset,
  saveLocalDataset,
  setLocalModeOptIn,
} from '@/lib/storage/repository';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type {
  AppDataset,
  Category,
  Goal,
  GoalContribution,
  GoalInvite,
  InvestmentProduct,
  PeriodPreset,
  PeriodSummary,
  RecurringRule,
  SheetsSyncConfig,
  Subcategory,
  ThemePreference,
  Transaction,
  TransactionType,
  Wallet,
  WalletBalanceSummary,
  WalletGroup,
} from '@/types/finance';

export interface QuickInputPreset {
  mode: 'create' | 'edit';
  transaction?: Transaction;
  type?: TransactionType;
  walletId?: string;
  toWalletId?: string;
  goalId?: string;
  subcategoryId?: string;
  investmentProductId?: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  undo?: () => void;
}

export interface AuthActionResult {
  error?: string;
  message?: string;
}

interface WalletContextValue {
  loading: boolean;
  syncingCloud: boolean;
  nowDate: Date;
  authMode: 'unauthenticated' | 'local' | 'supabase';
  supabaseConfigured: boolean;
  dataset: AppDataset;
  period: PeriodPreset;
  setPeriod: (p: PeriodPreset) => void;
  periodLabel: string;
  periodTransactions: Transaction[];
  periodSummary: PeriodSummary;
  walletBalances: WalletBalanceSummary[];
  visibleWalletBalances: WalletBalanceSummary[];
  netWorth: ReturnType<typeof calculateNetWorth>;
  recentWalletIds: string[];
  // Quick Input modal
  quickInputOpen: boolean;
  quickInputPreset: QuickInputPreset | null;
  openQuickInput: (preset?: QuickInputPreset) => void;
  closeQuickInput: () => void;
  // Receipt Scanner modal
  receiptScannerOpen: boolean;
  openReceiptScanner: () => void;
  closeReceiptScanner: () => void;
  // Toast
  toast: ToastMessage | null;
  dismissToast: () => void;
  // Auth
  signInWithGoogle: () => Promise<AuthActionResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<AuthActionResult>;
  continueLocalMode: () => void;
  signOut: () => Promise<void>;
  refreshCloudData: (silent?: boolean) => Promise<void>;
  // Mutations — Phase 1
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  addTransactionsBatch: (txs: Omit<Transaction, 'id' | 'createdAt'>[], batchLabel?: string) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (txId: string) => void;
  reconcileWallet: (walletId: string, actualBalance: number, note?: string) => void;
  updateWallet: (wallet: Wallet) => void;
  addWallet: (wallet: Omit<Wallet, 'id' | 'sortOrder'>) => void;
  updateOpeningBalances: (balances: Record<string, number>) => void;
  addCategory: (
    type: Category['type'],
    name: string,
    budgetCap: number | null,
    icon?: string,
    color?: string
  ) => void;
  updateCategoryCap: (categoryId: string, cap: number | null) => void;
  updateSubcategoryBudget: (subcategoryId: string, budget: number | null) => void;
  addSubcategory: (
    categoryId: string,
    name: string,
    monthlyBudget: number | null,
    aliases?: string[]
  ) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'priority' | 'status'>) => void;
  updateGoal: (goal: Goal) => void;
  deleteGoal: (goalId: string) => void;
  joinSharedGoal: (code: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  leaveSharedGoal: (goalId: string) => Promise<void>;
  addValuation: (walletId: string, marketValue: number, date?: string) => void;
  setTheme: (theme: ThemePreference) => void;
  togglePrivacyMode: () => void;
  setDisplayName: (name: string) => void;
  completeOnboarding: () => void;
  reopenOnboarding: () => void;
  resetLocalData: () => void;
  // Mutations — Phase 2 & 3
  addInvestmentProduct: (
    prod: Omit<InvestmentProduct, 'id' | 'sortOrder' | 'updatedAt'>
  ) => void;
  updateInvestmentProduct: (prod: InvestmentProduct) => void;
  updateProductMarketValue: (productId: string, marketValue: number) => void;
  deleteInvestmentProduct: (productId: string) => void;
  addGoalContribution: (contrib: Omit<GoalContribution, 'id'>) => void;
  deleteGoalContribution: (contribId: string) => void;
  saveGoalInvite: (invite: GoalInvite, options?: { silent?: boolean }) => void;
  addRecurringRule: (rule: Omit<RecurringRule, 'id'>) => void;
  updateRecurringRule: (rule: RecurringRule) => void;
  toggleRecurringRule: (ruleId: string) => void;
  deleteRecurringRule: (ruleId: string) => void;
  executeRecurringRule: (ruleId: string) => void;
  recordAIFeedback: (topic: string, vote: 'up' | 'down', note?: string) => void;
  clearAIMemory: () => void;
  updateSheetsSync: (partial: Partial<SheetsSyncConfig>) => void;
  triggerSheetsSync: () => Promise<{ ok: boolean; message: string }>;
  loadThreeMonthDummyData: () => void;
  removeDummyData: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);
const SSR_FALLBACK_DATE = new Date('2026-01-01T00:00:00.000Z');

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const supabaseConfigured = isSupabaseConfigured();
  const [loading, setLoading] = useState(true);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [authMode, setAuthMode] = useState<'unauthenticated' | 'local' | 'supabase'>('unauthenticated');
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [dataset, setDataset] = useState<AppDataset>(() => createInitialDataset());
  const [period, setPeriod] = useState<PeriodPreset>('this_month');
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const [recentWalletIds, setRecentWalletIds] = useState<string[]>(['w_gopay', 'w_jago', 'w_tunai']);
  const [quickInputOpen, setQuickInputOpen] = useState(false);
  const [quickInputPreset, setQuickInputPreset] = useState<QuickInputPreset | null>(null);
  const [receiptScannerOpen, setReceiptScannerOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const lastCloudSyncRef = useRef<number>(0);

  const showToast = useCallback((text: string, undo?: () => void) => {
    const id = generateUUID();
    setToast({ id, text, undo });
  }, []);

  // Auto-dismiss toast after 5s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Apply theme to <html>
  useEffect(() => {
    const pref = dataset.profile.theme || 'dark';
    const resolved =
      pref === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : pref;
    document.documentElement.setAttribute('data-theme', resolved);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', resolved === 'dark' ? '#0a1015' : '#f4f7f9');
    }
  }, [dataset.profile.theme]);

  // Register PWA Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Bootstrap Auth + Data
  useEffect(() => {
    let active = true;
    async function init() {
      const now = new Date();
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            setLocalModeOptIn(false);
            const loaded = await loadSupabaseDataset(supabase, session.user.id, {
              name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
              email: session.user.email,
              avatarUrl: session.user.user_metadata?.avatar_url,
            });
            if (!active) return;
            lastCloudSyncRef.current = Date.now();
            setClientNow(now);
            setCloudUserId(session.user.id);
            setDataset(loaded);
            setAuthMode('supabase');
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to auth/local screen if session check or initial load fails
        }
      }

      if (!supabase || isLocalModeOptedIn()) {
        setLocalModeOptIn(true);
        const local = loadLocalDataset();
        if (!active) return;
        setClientNow(now);
        setDataset(local);
        setAuthMode('local');
      } else {
        setClientNow(now);
        setAuthMode('unauthenticated');
      }
      setLoading(false);
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  const refreshCloudData = useCallback(
    async (silent = false) => {
      if (authMode !== 'supabase' || !cloudUserId) return;
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      setSyncingCloud(true);
      try {
        const loaded = await loadSupabaseDataset(supabase, cloudUserId, {
          name: dataset.profile.displayName,
          email: dataset.profile.email,
          avatarUrl: dataset.profile.avatarUrl,
        });
        lastCloudSyncRef.current = Date.now();
        setDataset(loaded);
        if (!silent) {
          showToast('Data cloud & Goal Bersama diperbarui');
        }
      } catch {
        if (!silent) {
          showToast('Gagal memuat ulang data cloud. Cek koneksi internetmu.');
        }
      } finally {
        setSyncingCloud(false);
      }
    },
    [
      authMode,
      cloudUserId,
      dataset.profile.avatarUrl,
      dataset.profile.displayName,
      dataset.profile.email,
      showToast,
    ]
  );

  // Throttled auto-refresh when returning to the app so partner's updates appear seamlessly
  useEffect(() => {
    if (authMode !== 'supabase' || !cloudUserId) return;
    const maybeSync = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastCloudSyncRef.current < 20_000) return;
      void refreshCloudData(true);
    };
    window.addEventListener('focus', maybeSync);
    document.addEventListener('visibilitychange', maybeSync);
    return () => {
      window.removeEventListener('focus', maybeSync);
      document.removeEventListener('visibilitychange', maybeSync);
    };
  }, [authMode, cloudUserId, refreshCloudData]);

  // Desktop global shortcut: N to open Quick Input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (authMode === 'unauthenticated' || !dataset.profile.onboardingCompleted) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'n' && !quickInputOpen) {
        e.preventDefault();
        setQuickInputPreset({ mode: 'create' });
        setQuickInputOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authMode, dataset.profile.onboardingCompleted, quickInputOpen]);

  // Helper to commit dataset updates optimistically
  const commitDataset = useCallback(
    (updater: (prev: AppDataset) => AppDataset) => {
      setDataset((prev) => {
        const next = updater(prev);
        if (authMode === 'local') {
          saveLocalDataset(next);
        }
        return next;
      });
    },
    [authMode]
  );

  // ==================== AUTH ACTIONS ====================

  const signInWithGoogle = useCallback(async (): Promise<AuthActionResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: 'Supabase belum terhubung.' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: 'Supabase belum terhubung.' };
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        if (error.message.toLowerCase().includes('invalid login')) {
          return { error: 'Email atau password salah. Cek kembali atau daftar akun baru.' };
        }
        if (error.message.toLowerCase().includes('email not confirmed')) {
          return { error: 'Email belum dikonfirmasi. Cek kotak masuk emailmu terlebih dahulu.' };
        }
        return { error: error.message };
      }
      if (data.user) {
        setLocalModeOptIn(false);
        const loaded = await loadSupabaseDataset(supabase, data.user.id, {
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
          email: data.user.email,
        });
        setCloudUserId(data.user.id);
        setDataset(loaded);
        setAuthMode('supabase');
      }
      return {};
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      displayName: string
    ): Promise<AuthActionResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: 'Supabase belum terhubung.' };
      if (password.length < 6) {
        return { error: 'Password minimal 6 karakter.' };
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: displayName.trim() || email.split('@')[0] },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) return { error: error.message };
      if (data.session && data.user) {
        setLocalModeOptIn(false);
        const loaded = await loadSupabaseDataset(supabase, data.user.id, {
          name: displayName.trim() || data.user.email?.split('@')[0],
          email: data.user.email,
        });
        setCloudUserId(data.user.id);
        setDataset(loaded);
        setAuthMode('supabase');
        return {};
      }
      return {
        message:
          'Akun dibuat! Cek kotak masuk emailmu untuk klik link verifikasi, lalu masuk kembali.',
      };
    },
    []
  );

  const continueLocalMode = useCallback(() => {
    setLocalModeOptIn(true);
    const local = loadLocalDataset();
    setDataset(local);
    setAuthMode('local');
  }, []);

  const signOut = useCallback(async () => {
    if (authMode === 'supabase') {
      const supabase = getSupabaseBrowserClient();
      if (supabase) await supabase.auth.signOut();
      setCloudUserId(null);
    }
    setLocalModeOptIn(false);
    setAuthMode('unauthenticated');
  }, [authMode]);

  // ==================== MUTATIONS — PHASE 1 ====================

  const addTransaction = useCallback(
    (input: Omit<Transaction, 'id' | 'createdAt'>) => {
      const tx: Transaction = {
        ...input,
        id: generateUUID(),
        createdAt: new Date().toISOString(),
      };
      const prodDelta =
        tx.investmentProductId && (tx.type === 'saving' || tx.type === 'saving_withdrawal')
          ? tx.type === 'saving'
            ? tx.amount
            : -tx.amount
          : 0;

      commitDataset((prev) => {
        const updatedProducts =
          prodDelta !== 0 && tx.investmentProductId
            ? prev.investmentProducts.map((p) =>
                p.id === tx.investmentProductId
                  ? {
                      ...p,
                      investedAmount: Math.max(0, p.investedAmount + prodDelta),
                      marketValue: Math.max(0, p.marketValue + prodDelta),
                      updatedAt: tx.date,
                    }
                  : p
              )
            : prev.investmentProducts;
        return {
          ...prev,
          transactions: [tx, ...prev.transactions],
          investmentProducts: updatedProducts,
        };
      });

      setRecentWalletIds((prev) =>
        [tx.walletId, ...prev.filter((id) => id !== tx.walletId)].slice(0, 3)
      );

      if (authMode === 'supabase' && cloudUserId) {
        const supabase = getSupabaseBrowserClient();
        supabase?.from('transactions').insert(mapTxToDb(tx, cloudUserId)).then(() => {});
        if (prodDelta !== 0 && tx.investmentProductId) {
          const curProd = dataset.investmentProducts.find((p) => p.id === tx.investmentProductId);
          if (curProd) {
            supabase
              ?.from('investment_products')
              .update({
                invested_amount: Math.max(0, curProd.investedAmount + prodDelta),
                market_value: Math.max(0, curProd.marketValue + prodDelta),
                updated_at: tx.date,
              })
              .eq('id', curProd.id)
              .then(() => {});
          }
        }
      }

      const labelMap: Record<TransactionType, string> = {
        expense: 'Expense',
        income: 'Income',
        saving: 'Saving',
        saving_withdrawal: 'Tarik Tabungan',
        transfer: 'Transfer',
        adjustment: 'Koreksi Saldo',
      };
      showToast(
        `${labelMap[tx.type]} ${formatIDR(Math.abs(tx.amount), dataset.profile.privacyMode)} tersimpan`,
        () => {
          commitDataset((prev) => ({
            ...prev,
            transactions: prev.transactions.filter((t) => t.id !== tx.id),
            investmentProducts:
              prodDelta !== 0 && tx.investmentProductId
                ? prev.investmentProducts.map((p) =>
                    p.id === tx.investmentProductId
                      ? {
                          ...p,
                          investedAmount: Math.max(0, p.investedAmount - prodDelta),
                          marketValue: Math.max(0, p.marketValue - prodDelta),
                        }
                      : p
                  )
                : prev.investmentProducts,
          }));
          if (authMode === 'supabase' && cloudUserId) {
            getSupabaseBrowserClient()?.from('transactions').delete().eq('id', tx.id).then(() => {});
          }
        }
      );
    },
    [
      authMode,
      cloudUserId,
      commitDataset,
      dataset.investmentProducts,
      dataset.profile.privacyMode,
      showToast,
    ]
  );

  const addTransactionsBatch = useCallback(
    (inputs: Omit<Transaction, 'id' | 'createdAt'>[], batchLabel = 'Scan Struk') => {
      if (inputs.length === 0) return;
      const nowIso = new Date().toISOString();
      const created: Transaction[] = inputs.map((inp) => ({
        ...inp,
        id: generateUUID(),
        createdAt: nowIso,
      }));
      const createdIds = new Set(created.map((t) => t.id));
      const totalAmt = created.reduce((s, t) => s + Math.abs(t.amount), 0);
      const firstWalletId = created[0].walletId;

      commitDataset((prev) => ({
        ...prev,
        transactions: [...created, ...prev.transactions],
      }));

      if (firstWalletId) {
        setRecentWalletIds((prev) =>
          [firstWalletId, ...prev.filter((id) => id !== firstWalletId)].slice(0, 3)
        );
      }

      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('transactions')
          .insert(created.map((tx) => mapTxToDb(tx, cloudUserId)))
          .then(() => {});
      }

      showToast(
        `${created.length} transaksi (${batchLabel} · ${formatIDR(totalAmt, dataset.profile.privacyMode)}) tersimpan`,
        () => {
          commitDataset((prev) => ({
            ...prev,
            transactions: prev.transactions.filter((t) => !createdIds.has(t.id)),
          }));
          if (authMode === 'supabase' && cloudUserId) {
            getSupabaseBrowserClient()
              ?.from('transactions')
              .delete()
              .in('id', [...createdIds])
              .then(() => {});
          }
        }
      );
    },
    [authMode, cloudUserId, commitDataset, dataset.profile.privacyMode, showToast]
  );

  const updateTransaction = useCallback(
    (tx: Transaction) => {
      commitDataset((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === tx.id ? tx : t)),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('transactions')
          .update(mapTxToDb(tx, cloudUserId))
          .eq('id', tx.id)
          .then(() => {});
      }
      showToast('Transaksi diperbarui');
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const deleteTransaction = useCallback(
    (txId: string) => {
      const removed = dataset.transactions.find((t) => t.id === txId);
      if (!removed) return;
      commitDataset((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== txId),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()?.from('transactions').delete().eq('id', txId).then(() => {});
      }
      showToast('Transaksi dihapus', () => {
        commitDataset((prev) => ({
          ...prev,
          transactions: [removed, ...prev.transactions],
        }));
        if (authMode === 'supabase' && cloudUserId) {
          getSupabaseBrowserClient()
            ?.from('transactions')
            .insert(mapTxToDb(removed, cloudUserId))
            .then(() => {});
        }
      });
    },
    [authMode, cloudUserId, commitDataset, dataset.transactions, showToast]
  );

  const walletBalances = useMemo(
    () =>
      calculateWalletBalances(
        dataset.wallets,
        dataset.transactions,
        dataset.valuations,
        dataset.investmentProducts
      ),
    [dataset.investmentProducts, dataset.transactions, dataset.valuations, dataset.wallets]
  );

  const visibleWalletBalances = useMemo(
    () => walletBalances.filter((b) => !b.wallet.hidden && !b.wallet.archived),
    [walletBalances]
  );

  const reconcileWallet = useCallback(
    (walletId: string, actualBalance: number, note = 'Rekonsiliasi saldo') => {
      const current = walletBalances.find((b) => b.wallet.id === walletId)?.balance ?? 0;
      const diff = Math.round(actualBalance - current);
      if (diff === 0) {
        showToast('Saldo sudah sesuai, tidak perlu koreksi');
        return;
      }
      addTransaction({
        date: todayISO(),
        type: 'adjustment',
        subcategoryId: null,
        walletId,
        toWalletId: null,
        amount: diff,
        fee: 0,
        goalId: null,
        note,
      });
    },
    [addTransaction, showToast, walletBalances]
  );

  const updateWallet = useCallback(
    (wallet: Wallet) => {
      commitDataset((prev) => ({
        ...prev,
        wallets: prev.wallets.map((w) => (w.id === wallet.id ? wallet : w)),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('wallets')
          .update(mapWalletToDb(wallet, cloudUserId))
          .eq('id', wallet.id)
          .then(() => {});
      }
    },
    [authMode, cloudUserId, commitDataset]
  );

  const addWallet = useCallback(
    (input: Omit<Wallet, 'id' | 'sortOrder'>) => {
      const wallet: Wallet = {
        ...input,
        id: generateUUID(),
        sortOrder: dataset.wallets.length + 1,
      };
      commitDataset((prev) => ({
        ...prev,
        wallets: [...prev.wallets, wallet],
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('wallets')
          .insert(mapWalletToDb(wallet, cloudUserId))
          .then(() => {});
      }
      showToast(`Wallet "${wallet.name}" ditambahkan`);
    },
    [authMode, cloudUserId, commitDataset, dataset.wallets.length, showToast]
  );

  const updateOpeningBalances = useCallback(
    (balances: Record<string, number>) => {
      const today = todayISO();
      commitDataset((prev) => ({
        ...prev,
        wallets: prev.wallets.map((w) =>
          balances[w.id] !== undefined
            ? { ...w, openingBalance: Math.round(balances[w.id]), openingDate: today }
            : w
        ),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          Object.entries(balances).forEach(([id, bal]) => {
            supabase
              .from('wallets')
              .update({ opening_balance: Math.round(bal), opening_date: today })
              .eq('id', id)
              .then(() => {});
          });
        }
      }
    },
    [authMode, cloudUserId, commitDataset]
  );

  const addCategory = useCallback(
    (
      type: Category['type'],
      name: string,
      budgetCap: number | null,
      icon = 'tag',
      color = '#10b981'
    ) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const catId = generateUUID();
      const cat: Category = {
        id: catId,
        type,
        name: trimmed,
        budgetCap,
        icon,
        color,
        archived: false,
        sortOrder: dataset.categories.filter((c) => c.type === type).length + 1,
      };
      const defaultSub: Subcategory = {
        id: generateUUID(),
        categoryId: catId,
        name: 'Umum',
        monthlyBudget: null,
        aliases: [],
        defaultNotes: [],
        archived: false,
        sortOrder: 1,
      };
      commitDataset((prev) => ({
        ...prev,
        categories: [...prev.categories, cat],
        subcategories: [...prev.subcategories, defaultSub],
      }));
      if (authMode === 'supabase' && cloudUserId) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          supabase
            .from('categories')
            .insert({
              id: cat.id,
              owner_id: cloudUserId,
              type: cat.type,
              name: cat.name,
              budget_cap: cat.budgetCap,
              icon: cat.icon,
              color: cat.color,
              archived: false,
              sort_order: cat.sortOrder,
            })
            .then(() => {
              supabase
                .from('subcategories')
                .insert({
                  id: defaultSub.id,
                  owner_id: cloudUserId,
                  category_id: cat.id,
                  name: defaultSub.name,
                  monthly_budget: null,
                  aliases: [],
                  default_notes: [],
                  archived: false,
                  sort_order: 1,
                })
                .then(() => {});
            });
        }
      }
      showToast(`Kategori "${trimmed}" ditambahkan`);
    },
    [authMode, cloudUserId, commitDataset, dataset.categories, showToast]
  );

  const updateCategoryCap = useCallback(
    (categoryId: string, cap: number | null) => {
      commitDataset((prev) => ({
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === categoryId ? { ...c, budgetCap: cap } : c
        ),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('categories')
          .update({ budget_cap: cap })
          .eq('id', categoryId)
          .then(() => {});
      }
    },
    [authMode, cloudUserId, commitDataset]
  );

  const updateSubcategoryBudget = useCallback(
    (subcategoryId: string, budget: number | null) => {
      commitDataset((prev) => ({
        ...prev,
        subcategories: prev.subcategories.map((s) =>
          s.id === subcategoryId ? { ...s, monthlyBudget: budget } : s
        ),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('subcategories')
          .update({ monthly_budget: budget })
          .eq('id', subcategoryId)
          .then(() => {});
      }
    },
    [authMode, cloudUserId, commitDataset]
  );

  const addSubcategory = useCallback(
    (categoryId: string, name: string, monthlyBudget: number | null, aliases: string[] = []) => {
      const sub: Subcategory = {
        id: generateUUID(),
        categoryId,
        name: name.trim(),
        monthlyBudget,
        aliases,
        defaultNotes: [],
        archived: false,
        sortOrder: dataset.subcategories.filter((s) => s.categoryId === categoryId).length + 1,
      };
      commitDataset((prev) => ({
        ...prev,
        subcategories: [...prev.subcategories, sub],
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('subcategories')
          .insert({
            id: sub.id,
            owner_id: cloudUserId,
            category_id: sub.categoryId,
            name: sub.name,
            monthly_budget: sub.monthlyBudget,
            aliases: sub.aliases,
            default_notes: sub.defaultNotes,
            archived: false,
            sort_order: sub.sortOrder,
          })
          .then(() => {});
      }
      showToast(`Sub-kategori "${sub.name}" ditambahkan`);
    },
    [authMode, cloudUserId, commitDataset, dataset.subcategories, showToast]
  );

  const addGoal = useCallback(
    (input: Omit<Goal, 'id' | 'priority' | 'status'>) => {
      const goal: Goal = {
        ...input,
        id: generateUUID(),
        ownerId: cloudUserId ?? undefined,
        sharedRole: 'owner',
        priority: dataset.goals.length + 1,
        status: 'active',
      };
      const autoInvite: GoalInvite | null = goal.isShared
        ? {
            goalId: goal.id,
            code: generateInviteCode(),
            partnerName: 'Pasangan',
            partnerEmail: '',
            sharePercent: 50,
            status: 'pending',
          }
        : null;
      commitDataset((prev) => ({
        ...prev,
        goals: [...prev.goals, goal],
        goalInvites: autoInvite ? [...prev.goalInvites, autoInvite] : prev.goalInvites,
      }));
      if (authMode === 'supabase' && cloudUserId) {
        const supabase = getSupabaseBrowserClient();
        supabase
          ?.from('goals')
          .insert(mapGoalToDb(goal, cloudUserId))
          .then(({ error }) => {
            if (!error && autoInvite) {
              supabase
                .from('goal_invites')
                .upsert(mapInviteToDb(autoInvite, cloudUserId))
                .then(() => {});
            }
          });
      }
      showToast(`Target "${goal.name}" dibuat`);
    },
    [authMode, cloudUserId, commitDataset, dataset.goals.length, showToast]
  );

  const updateGoal = useCallback(
    (goal: Goal) => {
      commitDataset((prev) => ({
        ...prev,
        goals: prev.goals.map((g) => (g.id === goal.id ? goal : g)),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('goals')
          .update(mapGoalToDb(goal, cloudUserId))
          .eq('id', goal.id)
          .then(() => {});
      }
    },
    [authMode, cloudUserId, commitDataset]
  );

  const deleteGoal = useCallback(
    (goalId: string) => {
      commitDataset((prev) => ({
        ...prev,
        goals: prev.goals.filter((g) => g.id !== goalId),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()?.from('goals').delete().eq('id', goalId).then(() => {});
      }
      showToast('Target tabungan dihapus');
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const joinSharedGoal = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string; message?: string }> => {
      if (authMode !== 'supabase' || !cloudUserId) {
        return {
          ok: false,
          error:
            'Fitur gabung Goal lintas akun butuh login akun cloud (Supabase). Silakan masuk dengan akunmu dulu ya.',
        };
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return { ok: false, error: 'Koneksi Supabase tidak tersedia.' };
      }
      const res = await joinSharedGoalByCode(supabase, code);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      await refreshCloudData(true);
      const msg = `Berhasil gabung ke goal "${res.goalName || 'Bersama'}" milik ${res.ownerName || 'Pasangan'}!`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [authMode, cloudUserId, refreshCloudData, showToast]
  );

  const leaveSharedGoal = useCallback(
    async (goalId: string) => {
      if (authMode !== 'supabase' || !cloudUserId) return;
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const res = await leaveSharedGoalById(supabase, goalId);
      if (!res.ok) {
        showToast(res.error || 'Gagal keluar dari goal bersama');
        return;
      }
      commitDataset((prev) => {
        const nextPeers = { ...(prev.sharedGoalPeers ?? {}) };
        delete nextPeers[goalId];
        return {
          ...prev,
          goals: prev.goals.filter((g) => g.id !== goalId),
          sharedGoalPeers: nextPeers,
        };
      });
      showToast('Kamu keluar dari goal bersama');
      void refreshCloudData(true);
    },
    [authMode, cloudUserId, commitDataset, refreshCloudData, showToast]
  );

  const addValuation = useCallback(
    (walletId: string, marketValue: number, date = todayISO()) => {
      const val = { id: generateUUID(), walletId, date, marketValue: Math.round(marketValue) };
      commitDataset((prev) => ({
        ...prev,
        valuations: [val, ...prev.valuations],
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('wallet_valuations')
          .insert({
            id: val.id,
            owner_id: cloudUserId,
            wallet_id: walletId,
            date,
            market_value: val.marketValue,
          })
          .then(() => {});
      }
      showToast(
        `Nilai pasar diperbarui ke ${formatIDR(val.marketValue, dataset.profile.privacyMode)}`
      );
    },
    [authMode, cloudUserId, commitDataset, dataset.profile.privacyMode, showToast]
  );

  // ==================== MUTATIONS — PHASE 2 & 3 ====================

  const addInvestmentProduct = useCallback(
    (input: Omit<InvestmentProduct, 'id' | 'sortOrder' | 'updatedAt'>) => {
      const today = todayISO();
      const prod: InvestmentProduct = {
        ...input,
        id: generateUUID(),
        ownerId: cloudUserId ?? undefined,
        investedAmount: Math.round(Math.max(0, input.investedAmount)),
        marketValue: Math.round(Math.max(0, input.marketValue)),
        updatedAt: today,
        sortOrder: dataset.investmentProducts.length + 1,
      };
      commitDataset((prev) => {
        const nextProds = [...prev.investmentProducts, prod];
        const totalMarket = nextProds
          .filter((p) => p.walletId === prod.walletId)
          .reduce((s, p) => s + p.marketValue, 0);
        const nextVals =
          totalMarket > 0
            ? [
                {
                  id: generateUUID(),
                  walletId: prod.walletId,
                  date: today,
                  marketValue: totalMarket,
                },
                ...prev.valuations.filter(
                  (v) => !(v.walletId === prod.walletId && v.date === today)
                ),
              ]
            : prev.valuations;
        return { ...prev, investmentProducts: nextProds, valuations: nextVals };
      });
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('investment_products')
          .insert(mapProductToDb(prod, cloudUserId))
          .then(() => {});
      }
      showToast(`Produk "${prod.name}" ditambahkan`);
    },
    [authMode, cloudUserId, commitDataset, dataset.investmentProducts.length, showToast]
  );

  const updateInvestmentProduct = useCallback(
    (prod: InvestmentProduct) => {
      const today = todayISO();
      const updated = {
        ...prod,
        investedAmount: Math.round(Math.max(0, prod.investedAmount)),
        marketValue: Math.round(Math.max(0, prod.marketValue)),
        updatedAt: today,
      };
      commitDataset((prev) => {
        const nextProds = prev.investmentProducts.map((p) => (p.id === updated.id ? updated : p));
        const totalMarket = nextProds
          .filter((p) => p.walletId === updated.walletId)
          .reduce((s, p) => s + p.marketValue, 0);
        const nextVals =
          totalMarket > 0
            ? [
                {
                  id: generateUUID(),
                  walletId: updated.walletId,
                  date: today,
                  marketValue: totalMarket,
                },
                ...prev.valuations.filter(
                  (v) => !(v.walletId === updated.walletId && v.date === today)
                ),
              ]
            : prev.valuations;
        return { ...prev, investmentProducts: nextProds, valuations: nextVals };
      });
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('investment_products')
          .update(mapProductToDb(updated, cloudUserId))
          .eq('id', updated.id)
          .then(() => {});
      }
      showToast(`Produk "${updated.name}" diperbarui`);
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const updateProductMarketValue = useCallback(
    (productId: string, marketValue: number) => {
      const target = dataset.investmentProducts.find((p) => p.id === productId);
      if (!target) return;
      updateInvestmentProduct({ ...target, marketValue: Math.round(Math.max(0, marketValue)) });
    },
    [dataset.investmentProducts, updateInvestmentProduct]
  );

  const deleteInvestmentProduct = useCallback(
    (productId: string) => {
      commitDataset((prev) => ({
        ...prev,
        investmentProducts: prev.investmentProducts.filter((p) => p.id !== productId),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('investment_products')
          .delete()
          .eq('id', productId)
          .then(() => {});
      }
      showToast('Produk investasi dihapus');
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const addGoalContribution = useCallback(
    (input: Omit<GoalContribution, 'id'>) => {
      const contrib: GoalContribution = {
        ...input,
        id: generateUUID(),
        contributorUserId: input.contributorUserId ?? cloudUserId ?? null,
        amount: Math.round(Math.max(0, input.amount)),
      };
      commitDataset((prev) => ({
        ...prev,
        goalContributions: [contrib, ...prev.goalContributions],
      }));
      if (authMode === 'supabase' && cloudUserId) {
        const supabase = getSupabaseBrowserClient();
        supabase
          ?.from('goal_contributions')
          .insert(mapContributionToDb(contrib, cloudUserId, true))
          .then(({ error }) => {
            if (error && (error.message || '').toLowerCase().includes('contributor_user_id')) {
              supabase
                .from('goal_contributions')
                .insert(mapContributionToDb(contrib, cloudUserId, false))
                .then(() => {});
            }
          });
      }
      showToast(
        `Setoran ${contrib.contributorName} (${formatIDR(contrib.amount, dataset.profile.privacyMode)}) dicatat`
      );
    },
    [authMode, cloudUserId, commitDataset, dataset.profile.privacyMode, showToast]
  );

  const deleteGoalContribution = useCallback(
    (contribId: string) => {
      commitDataset((prev) => ({
        ...prev,
        goalContributions: prev.goalContributions.filter((c) => c.id !== contribId),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('goal_contributions')
          .delete()
          .eq('id', contribId)
          .then(() => {});
      }
      showToast('Catatan kontribusi dihapus');
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const saveGoalInvite = useCallback(
    (invite: GoalInvite, options?: { silent?: boolean }) => {
      const rawCode = invite.code.trim().toUpperCase();
      const normalized: GoalInvite = {
        ...invite,
        code: !rawCode || rawCode === 'MW-WED-2027' ? generateInviteCode() : rawCode,
      };
      commitDataset((prev) => {
        const exists = prev.goalInvites.some((i) => i.goalId === normalized.goalId);
        return {
          ...prev,
          goalInvites: exists
            ? prev.goalInvites.map((i) => (i.goalId === normalized.goalId ? normalized : i))
            : [...prev.goalInvites, normalized],
        };
      });
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('goal_invites')
          .upsert(mapInviteToDb(normalized, cloudUserId))
          .then(() => {});
      }
      if (!options?.silent) {
        showToast('Pengaturan berbagi pasangan disimpan');
      }
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const addRecurringRule = useCallback(
    (input: Omit<RecurringRule, 'id'>) => {
      const rule: RecurringRule = {
        ...input,
        id: generateUUID(),
        amount: Math.round(Math.max(0, input.amount)),
      };
      commitDataset((prev) => ({
        ...prev,
        recurringRules: [...prev.recurringRules, rule],
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('recurring_rules')
          .insert(mapRecurringToDb(rule, cloudUserId))
          .then(() => {});
      }
      showToast(`Jadwal rutin "${rule.label}" ditambahkan`);
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const updateRecurringRule = useCallback(
    (rule: RecurringRule) => {
      const normalized: RecurringRule = {
        ...rule,
        label: rule.label.trim(),
        amount: Math.round(Math.max(0, rule.amount)),
        dayOfMonth: Math.min(28, Math.max(1, rule.dayOfMonth || 1)),
      };
      commitDataset((prev) => ({
        ...prev,
        recurringRules: prev.recurringRules.map((r) =>
          r.id === normalized.id ? normalized : r
        ),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('recurring_rules')
          .update(mapRecurringToDb(normalized, cloudUserId))
          .eq('id', normalized.id)
          .then(() => {});
      }
      showToast(`Jadwal rutin "${normalized.label}" diperbarui`);
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const toggleRecurringRule = useCallback(
    (ruleId: string) => {
      const target = dataset.recurringRules.find((r) => r.id === ruleId);
      if (!target) return;
      const nextActive = !target.active;
      commitDataset((prev) => ({
        ...prev,
        recurringRules: prev.recurringRules.map((r) =>
          r.id === ruleId ? { ...r, active: nextActive } : r
        ),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('recurring_rules')
          .update({ active: nextActive })
          .eq('id', ruleId)
          .then(() => {});
      }
    },
    [authMode, cloudUserId, commitDataset, dataset.recurringRules]
  );

  const deleteRecurringRule = useCallback(
    (ruleId: string) => {
      commitDataset((prev) => ({
        ...prev,
        recurringRules: prev.recurringRules.filter((r) => r.id !== ruleId),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('recurring_rules')
          .delete()
          .eq('id', ruleId)
          .then(() => {});
      }
      showToast('Jadwal berulang dihapus');
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const executeRecurringRule = useCallback(
    (ruleId: string) => {
      const rule = dataset.recurringRules.find((r) => r.id === ruleId);
      if (!rule) return;
      addTransaction({
        date: todayISO(),
        type: rule.type,
        amount: rule.amount,
        fee: 0,
        subcategoryId: rule.subcategoryId,
        walletId: rule.walletId,
        toWalletId: rule.toWalletId,
        goalId: rule.goalId,
        investmentProductId: rule.investmentProductId ?? null,
        note: rule.note || rule.label,
      });
      const nextRun = advanceRecurringDate(todayISO(), rule.frequency, rule.dayOfMonth);
      commitDataset((prev) => ({
        ...prev,
        recurringRules: prev.recurringRules.map((r) =>
          r.id === ruleId ? { ...r, nextRun } : r
        ),
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('recurring_rules')
          .update({ next_run: nextRun })
          .eq('id', ruleId)
          .then(() => {});
      }
    },
    [addTransaction, authMode, cloudUserId, commitDataset, dataset.recurringRules]
  );

  const recordAIFeedback = useCallback(
    (topic: string, vote: 'up' | 'down', note = '') => {
      const entry = {
        id: generateUUID(),
        topic,
        vote,
        note: note || (vote === 'up' ? `Suka saran topik ${topic}` : `Kurangi saran topik ${topic}`),
        createdAt: new Date().toISOString(),
      };
      commitDataset((prev) => {
        const nextPatterns =
          vote === 'up'
            ? Array.from(new Set([...prev.aiMemory.patterns, `Menyukai insight detail tentang ${topic}`])).slice(-8)
            : Array.from(new Set([...prev.aiMemory.patterns, `Kurang tertarik saran berulang soal ${topic}`])).slice(-8);
        const nextMem = {
          ...prev.aiMemory,
          patterns: nextPatterns,
          feedbackLog: [entry, ...prev.aiMemory.feedbackLog].slice(0, 30),
        };
        if (authMode === 'supabase' && cloudUserId) {
          getSupabaseBrowserClient()
            ?.from('ai_memory')
            .upsert({
              owner_id: cloudUserId,
              patterns: nextMem.patterns,
              preferences: nextMem.preferences,
              feedback_log: nextMem.feedbackLog,
              updated_at: new Date().toISOString(),
            })
            .then(() => {});
        }
        return { ...prev, aiMemory: nextMem };
      });
      showToast(vote === 'up' ? '👍 Disimpan ke AI Memory' : '👎 Preferensi disimpan ke AI Memory');
    },
    [authMode, cloudUserId, commitDataset, showToast]
  );

  const clearAIMemory = useCallback(() => {
    commitDataset((prev) => ({
      ...prev,
      aiMemory: { patterns: [], preferences: {}, feedbackLog: [] },
    }));
    if (authMode === 'supabase' && cloudUserId) {
      getSupabaseBrowserClient()
        ?.from('ai_memory')
        .upsert({
          owner_id: cloudUserId,
          patterns: [],
          preferences: {},
          feedback_log: [],
          updated_at: new Date().toISOString(),
        })
        .then(() => {});
    }
    showToast('AI Memory dibersihkan');
  }, [authMode, cloudUserId, commitDataset, showToast]);

  const updateSheetsSync = useCallback(
    (partial: Partial<SheetsSyncConfig>) => {
      commitDataset((prev) => {
        const next = { ...prev.sheetsSync, ...partial };
        if (authMode === 'supabase' && cloudUserId) {
          getSupabaseBrowserClient()
            ?.from('sheets_sync')
            .upsert({
              owner_id: cloudUserId,
              spreadsheet_id: next.spreadsheetId,
              spreadsheet_url: next.spreadsheetUrl,
              auto_sync: next.autoSync,
              last_synced_at: next.lastSyncedAt,
              status: next.status,
            })
            .then(() => {});
        }
        return { ...prev, sheetsSync: next };
      });
    },
    [authMode, cloudUserId, commitDataset]
  );

  const triggerSheetsSync = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: dataset.sheetsSync.spreadsheetUrl,
          dataset,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        return { ok: false, message: json.error || 'Gagal sinkron ke Google Sheets.' };
      }
      const syncedAt = json.syncedAt || new Date().toISOString();
      updateSheetsSync({
        status: json.synced ? 'connected' : dataset.sheetsSync.status,
        lastSyncedAt: syncedAt,
      });
      showToast(json.message || 'Sinkron Google Sheets selesai');
      return { ok: true, message: json.message };
    } catch {
      return { ok: false, message: 'Gagal terhubung ke endpoint sinkronisasi.' };
    }
  }, [dataset, showToast, updateSheetsSync]);

  const loadThreeMonthDummyData = useCallback(() => {
    commitDataset((prev) => applyThreeMonthDummyData(prev, new Date()));
    showToast('🧪 Data dummy 3 bulan dimuat (bisa dihapus 1-klik kapan saja)');
  }, [commitDataset, showToast]);

  const removeDummyData = useCallback(() => {
    commitDataset((prev) => clearDummyData(prev, new Date()));
    setPeriod('this_month');
    showToast('🧹 Data dummy dihapus — mulai bersih dari 0');
  }, [commitDataset, showToast]);

  // ==================== PROFILE ====================

  const syncProfileField = useCallback(
    (fields: Record<string, unknown>) => {
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('profiles')
          .update(fields)
          .eq('id', cloudUserId)
          .then(() => {});
      }
    },
    [authMode, cloudUserId]
  );

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      commitDataset((prev) => ({ ...prev, profile: { ...prev.profile, theme } }));
      syncProfileField({ theme });
    },
    [commitDataset, syncProfileField]
  );

  const togglePrivacyMode = useCallback(() => {
    commitDataset((prev) => {
      const nextPrivacy = !prev.profile.privacyMode;
      syncProfileField({ privacy_mode: nextPrivacy });
      return { ...prev, profile: { ...prev.profile, privacyMode: nextPrivacy } };
    });
  }, [commitDataset, syncProfileField]);

  const setDisplayName = useCallback(
    (displayName: string) => {
      commitDataset((prev) => ({ ...prev, profile: { ...prev.profile, displayName } }));
      syncProfileField({ display_name: displayName });
    },
    [commitDataset, syncProfileField]
  );

  const completeOnboarding = useCallback(() => {
    commitDataset((prev) => ({
      ...prev,
      profile: { ...prev.profile, onboardingCompleted: true },
    }));
    syncProfileField({ onboarding_completed: true });
  }, [commitDataset, syncProfileField]);

  const reopenOnboarding = useCallback(() => {
    commitDataset((prev) => ({
      ...prev,
      profile: { ...prev.profile, onboardingCompleted: false },
    }));
  }, [commitDataset]);

  const resetLocalData = useCallback(() => {
    const fresh = resetLocalDataset();
    setDataset(fresh);
    showToast('Data lokal dikembalikan ke awal');
  }, [showToast]);

  // ==================== DERIVED METRICS ====================

  const periodInfo = useMemo(
    () =>
      clientNow
        ? getPeriodRange(period, clientNow)
        : { start: null, end: null, label: 'Bulan ini' },
    [clientNow, period]
  );
  const periodTransactions = useMemo(
    () => filterTransactionsByRange(dataset.transactions, periodInfo.start, periodInfo.end),
    [dataset.transactions, periodInfo.start, periodInfo.end]
  );
  const periodSummary = useMemo(
    () => calculatePeriodSummary(periodTransactions),
    [periodTransactions]
  );
  const netWorth = useMemo(() => calculateNetWorth(walletBalances), [walletBalances]);

  const openQuickInput = useCallback((preset?: QuickInputPreset) => {
    setQuickInputPreset(preset ?? { mode: 'create' });
    setQuickInputOpen(true);
  }, []);

  const closeQuickInput = useCallback(() => {
    setQuickInputOpen(false);
    setQuickInputPreset(null);
  }, []);

  const openReceiptScanner = useCallback(() => {
    setQuickInputOpen(false);
    setReceiptScannerOpen(true);
  }, []);

  const closeReceiptScanner = useCallback(() => {
    setReceiptScannerOpen(false);
  }, []);

  const value: WalletContextValue = {
    loading,
    syncingCloud,
    nowDate: clientNow ?? SSR_FALLBACK_DATE,
    authMode,
    supabaseConfigured,
    dataset,
    period,
    setPeriod,
    periodLabel: periodInfo.label,
    periodTransactions,
    periodSummary,
    walletBalances,
    visibleWalletBalances,
    netWorth,
    recentWalletIds,
    quickInputOpen,
    quickInputPreset,
    openQuickInput,
    closeQuickInput,
    receiptScannerOpen,
    openReceiptScanner,
    closeReceiptScanner,
    toast,
    dismissToast: () => setToast(null),
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    continueLocalMode,
    signOut,
    refreshCloudData,
    addTransaction,
    addTransactionsBatch,
    updateTransaction,
    deleteTransaction,
    reconcileWallet,
    updateWallet,
    addWallet,
    updateOpeningBalances,
    addCategory,
    updateCategoryCap,
    updateSubcategoryBudget,
    addSubcategory,
    addGoal,
    updateGoal,
    deleteGoal,
    joinSharedGoal,
    leaveSharedGoal,
    addValuation,
    setTheme,
    togglePrivacyMode,
    setDisplayName,
    completeOnboarding,
    reopenOnboarding,
    resetLocalData,
    addInvestmentProduct,
    updateInvestmentProduct,
    updateProductMarketValue,
    deleteInvestmentProduct,
    addGoalContribution,
    deleteGoalContribution,
    saveGoalInvite,
    addRecurringRule,
    updateRecurringRule,
    toggleRecurringRule,
    deleteRecurringRule,
    executeRecurringRule,
    recordAIFeedback,
    clearAIMemory,
    updateSheetsSync,
    triggerSheetsSync,
    loadThreeMonthDummyData,
    removeDummyData,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}

export type { Category, WalletGroup };
