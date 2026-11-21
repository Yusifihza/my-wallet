'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  calculateNetWorth,
  calculatePeriodSummary,
  calculateWalletBalances,
  filterTransactionsByRange,
  formatIDR,
  getPeriodRange,
} from '@/lib/finance';
import { createInitialDataset, todayISO } from '@/lib/seed';
import {
  generateUUID,
  isLocalModeOptedIn,
  loadLocalDataset,
  loadSupabaseDataset,
  mapGoalToDb,
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
  PeriodPreset,
  PeriodSummary,
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
}

export interface ToastMessage {
  id: string;
  text: string;
  undo?: () => void;
}

interface WalletContextValue {
  loading: boolean;
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
  // Toast
  toast: ToastMessage | null;
  dismissToast: () => void;
  // Auth
  signInWithGoogle: () => Promise<void>;
  continueLocalMode: () => void;
  signOut: () => Promise<void>;
  // Mutations
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (txId: string) => void;
  reconcileWallet: (walletId: string, actualBalance: number, note?: string) => void;
  updateWallet: (wallet: Wallet) => void;
  addWallet: (wallet: Omit<Wallet, 'id' | 'sortOrder'>) => void;
  updateOpeningBalances: (balances: Record<string, number>) => void;
  updateCategoryCap: (categoryId: string, cap: number | null) => void;
  updateSubcategoryBudget: (subcategoryId: string, budget: number | null) => void;
  addSubcategory: (categoryId: string, name: string, monthlyBudget: number | null, aliases?: string[]) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'priority' | 'status'>) => void;
  updateGoal: (goal: Goal) => void;
  deleteGoal: (goalId: string) => void;
  addValuation: (walletId: string, marketValue: number, date?: string) => void;
  setTheme: (theme: ThemePreference) => void;
  togglePrivacyMode: () => void;
  setDisplayName: (name: string) => void;
  completeOnboarding: () => void;
  reopenOnboarding: () => void;
  resetLocalData: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const supabaseConfigured = isSupabaseConfigured();
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'unauthenticated' | 'local' | 'supabase'>('unauthenticated');
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [dataset, setDataset] = useState<AppDataset>(() => createInitialDataset());
  const [period, setPeriod] = useState<PeriodPreset>('this_month');
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const [recentWalletIds, setRecentWalletIds] = useState<string[]>(['w_gopay', 'w_jago', 'w_tunai']);
  const [quickInputOpen, setQuickInputOpen] = useState(false);
  const [quickInputPreset, setQuickInputPreset] = useState<QuickInputPreset | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

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
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const loaded = await loadSupabaseDataset(supabase, session.user.id, {
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            email: session.user.email,
            avatarUrl: session.user.user_metadata?.avatar_url,
          });
          if (!active) return;
          setClientNow(now);
          setCloudUserId(session.user.id);
          setDataset(loaded);
          setAuthMode('supabase');
          setLoading(false);
          return;
        }
      }

      if (isLocalModeOptedIn()) {
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

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

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

  // ==================== MUTATIONS ====================

  const addTransaction = useCallback(
    (input: Omit<Transaction, 'id' | 'createdAt'>) => {
      const tx: Transaction = {
        ...input,
        id: generateUUID(),
        createdAt: new Date().toISOString(),
      };
      commitDataset((prev) => ({
        ...prev,
        transactions: [tx, ...prev.transactions],
      }));

      setRecentWalletIds((prev) =>
        [tx.walletId, ...prev.filter((id) => id !== tx.walletId)].slice(0, 3)
      );

      if (authMode === 'supabase' && cloudUserId) {
        const supabase = getSupabaseBrowserClient();
        supabase?.from('transactions').insert(mapTxToDb(tx, cloudUserId)).then(() => {});
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
          }));
          if (authMode === 'supabase' && cloudUserId) {
            getSupabaseBrowserClient()?.from('transactions').delete().eq('id', tx.id).then(() => {});
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
    () => calculateWalletBalances(dataset.wallets, dataset.transactions, dataset.valuations),
    [dataset.wallets, dataset.transactions, dataset.valuations]
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
        priority: dataset.goals.length + 1,
        status: 'active',
      };
      commitDataset((prev) => ({
        ...prev,
        goals: [...prev.goals, goal],
      }));
      if (authMode === 'supabase' && cloudUserId) {
        getSupabaseBrowserClient()
          ?.from('goals')
          .insert(mapGoalToDb(goal, cloudUserId))
          .then(() => {});
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
      showToast(`Nilai pasar diperbarui ke ${formatIDR(val.marketValue, dataset.profile.privacyMode)}`);
    },
    [authMode, cloudUserId, commitDataset, dataset.profile.privacyMode, showToast]
  );

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

  const value: WalletContextValue = {
    loading,
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
    toast,
    dismissToast: () => setToast(null),
    signInWithGoogle,
    continueLocalMode,
    signOut,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    reconcileWallet,
    updateWallet,
    addWallet,
    updateOpeningBalances,
    updateCategoryCap,
    updateSubcategoryBudget,
    addSubcategory,
    addGoal,
    updateGoal,
    deleteGoal,
    addValuation,
    setTheme,
    togglePrivacyMode,
    setDisplayName,
    completeOnboarding,
    reopenOnboarding,
    resetLocalData,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}

export type { Category, WalletGroup };
