'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Search,
  Target,
  X,
} from 'lucide-react';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import {
  calculateCategoryBudgets,
  formatDateID,
  formatIDR,
  formatIDRCompact,
  formatMonthYearID,
  parseAmountExpression,
  toISODate,
} from '@/lib/finance';
import { todayISO, WALLET_GROUP_LABELS, WALLET_GROUP_ORDER } from '@/lib/seed';
import type { TransactionType } from '@/types/finance';

type ActiveTab = 'expense' | 'income' | 'saving' | 'transfer';
type SubModal = null | 'category' | 'wallet' | 'toWallet' | 'date' | 'note' | 'goal';

const TAB_CONFIG: Record<ActiveTab, { label: string; color: string; soft: string }> = {
  expense: { label: 'Expense', color: 'var(--mw-expense)', soft: 'var(--mw-expense-soft)' },
  income: { label: 'Income', color: 'var(--mw-income)', soft: 'var(--mw-income-soft)' },
  saving: { label: 'Saving', color: 'var(--mw-saving)', soft: 'var(--mw-saving-soft)' },
  transfer: { label: 'Transfer', color: 'var(--mw-transfer)', soft: 'var(--mw-transfer-soft)' },
};

export function QuickInputSheet() {
  const { quickInputOpen, quickInputPreset } = useWallet();
  if (!quickInputOpen) return null;

  const instanceKey = `${quickInputPreset?.mode ?? 'create'}-${quickInputPreset?.transaction?.id ?? ''}-${quickInputPreset?.type ?? ''}-${quickInputPreset?.walletId ?? ''}-${quickInputPreset?.goalId ?? ''}`;
  return <QuickInputSheetInner key={instanceKey} />;
}

function QuickInputSheetInner() {
  const {
    dataset,
    quickInputPreset,
    closeQuickInput,
    visibleWalletBalances,
    periodTransactions,
    recentWalletIds,
    addTransaction,
    updateTransaction,
  } = useWallet();

  const today = todayISO();
  const privacy = dataset.profile.privacyMode;

  const isEdit = quickInputPreset?.mode === 'edit' && Boolean(quickInputPreset.transaction);
  const editTx = quickInputPreset?.transaction;

  const visibleWallets = useMemo(
    () => visibleWalletBalances.map((b) => b.wallet),
    [visibleWalletBalances]
  );

  const balanceById = useMemo(
    () => new Map(visibleWalletBalances.map((b) => [b.wallet.id, b])),
    [visibleWalletBalances]
  );

  const defaultLiquidWalletId = useMemo(() => {
    const recent = recentWalletIds.find((id) =>
      visibleWallets.some((w) => w.id === id && w.group !== 'investment')
    );
    return (
      recent ||
      visibleWallets.find((w) => w.name === 'GoPay')?.id ||
      visibleWallets.find((w) => w.group !== 'investment')?.id ||
      visibleWallets[0]?.id ||
      ''
    );
  }, [recentWalletIds, visibleWallets]);

  const defaultBankWalletId = useMemo(() => {
    return (
      visibleWallets.find((w) => w.name === 'Jago')?.id ||
      visibleWallets.find((w) => w.group === 'bank')?.id ||
      defaultLiquidWalletId
    );
  }, [defaultLiquidWalletId, visibleWallets]);

  const defaultInvestWalletId = useMemo(() => {
    return (
      visibleWallets.find((w) => w.group === 'investment')?.id ||
      visibleWallets.find((w) => w.id !== defaultBankWalletId)?.id ||
      defaultLiquidWalletId
    );
  }, [defaultBankWalletId, defaultLiquidWalletId, visibleWallets]);

  const getDefaultSubForType = useCallback(
    (catType: 'expense' | 'income' | 'saving'): string | null => {
      if (catType === 'expense') {
        return (
          dataset.subcategories.find((s) => s.name === 'Kafe' && !s.archived)?.id ||
          dataset.subcategories.find((s) => {
            const c = dataset.categories.find((cat) => cat.id === s.categoryId);
            return c?.type === 'expense' && !s.archived;
          })?.id ||
          null
        );
      }
      if (catType === 'income') {
        return (
          dataset.subcategories.find((s) => s.name === 'Gaji' && !s.archived)?.id ||
          dataset.subcategories.find((s) => {
            const c = dataset.categories.find((cat) => cat.id === s.categoryId);
            return c?.type === 'income' && !s.archived;
          })?.id ||
          null
        );
      }
      return (
        dataset.subcategories.find((s) => s.name === 'Wedding' && !s.archived)?.id ||
        dataset.subcategories.find((s) => {
          const c = dataset.categories.find((cat) => cat.id === s.categoryId);
          return c?.type === 'saving' && !s.archived;
        })?.id ||
        null
      );
    },
    [dataset]
  );

  const initialTab: ActiveTab = (() => {
    if (editTx) {
      if (editTx.type === 'saving_withdrawal') return 'saving';
      if (editTx.type === 'adjustment') return 'expense';
      return editTx.type;
    }
    const pType = quickInputPreset?.type;
    if (pType === 'saving_withdrawal') return 'saving';
    if (pType === 'income' || pType === 'saving' || pType === 'transfer') return pType;
    return 'expense';
  })();

  const [tab, setTab] = useState<ActiveTab>(initialTab);
  const [savingDirection, setSavingDirection] = useState<'saving' | 'saving_withdrawal'>(() =>
    editTx?.type === 'saving_withdrawal' || quickInputPreset?.type === 'saving_withdrawal'
      ? 'saving_withdrawal'
      : 'saving'
  );
  const [expr, setExpr] = useState<string>(() => (editTx ? String(Math.abs(editTx.amount)) : ''));
  const [goalId, setGoalId] = useState<string | null>(() => {
    if (editTx) return editTx.goalId;
    return initialTab === 'saving' ? quickInputPreset?.goalId ?? null : null;
  });
  const [subId, setSubId] = useState<string | null>(() => {
    if (editTx) return editTx.subcategoryId;
    if (initialTab === 'transfer') return null;
    if (quickInputPreset?.subcategoryId) return quickInputPreset.subcategoryId;
    if (initialTab === 'saving' && quickInputPreset?.goalId) {
      const g = dataset.goals.find((x) => x.id === quickInputPreset.goalId);
      if (g?.subcategoryId) return g.subcategoryId;
    }
    return getDefaultSubForType(initialTab);
  });
  const [walletId, setWalletId] = useState<string>(() => {
    if (editTx) return editTx.walletId;
    if (quickInputPreset?.walletId) return quickInputPreset.walletId;
    if (initialTab === 'transfer' || initialTab === 'saving' || initialTab === 'income') {
      return defaultBankWalletId;
    }
    return defaultLiquidWalletId;
  });
  const [toWalletId, setToWalletId] = useState<string>(() => {
    if (editTx) return editTx.toWalletId || defaultInvestWalletId;
    if (quickInputPreset?.toWalletId) return quickInputPreset.toWalletId;
    if (initialTab === 'transfer') {
      const from = quickInputPreset?.walletId || defaultBankWalletId;
      return (
        visibleWallets.find((w) => w.id !== from && w.name === 'GoPay')?.id ||
        visibleWallets.find((w) => w.id !== from)?.id ||
        from
      );
    }
    if (initialTab === 'saving' && quickInputPreset?.goalId) {
      const g = dataset.goals.find((x) => x.id === quickInputPreset.goalId);
      if (g?.walletId) return g.walletId;
    }
    return defaultInvestWalletId;
  });
  const [fee, setFee] = useState<number>(() => editTx?.fee ?? 0);
  const [customFeeMode, setCustomFeeMode] = useState<boolean>(() =>
    Boolean(editTx?.fee && ![0, 2500, 6500].includes(editTx.fee))
  );
  const [customFeeText, setCustomFeeText] = useState<string>(() =>
    editTx?.fee && ![0, 2500, 6500].includes(editTx.fee) ? String(editTx.fee) : ''
  );
  const [date, setDate] = useState<string>(() => editTx?.date ?? today);
  const [note, setNote] = useState<string>(() => editTx?.note ?? '');
  const [investmentProductId, setInvestmentProductId] = useState<string | null>(
    () => editTx?.investmentProductId ?? quickInputPreset?.investmentProductId ?? null
  );
  const [subModal, setSubModal] = useState<SubModal>(null);
  const [catQuery, setCatQuery] = useState('');
  const [walletQuery, setWalletQuery] = useState('');

  const initDateObj = new Date(`${editTx?.date || today}T00:00:00`);
  const [calYear, setCalYear] = useState(initDateObj.getFullYear());
  const [calMonth, setCalMonth] = useState(initDateObj.getMonth());

  const desktopAmountRef = useRef<HTMLInputElement>(null);
  const catSearchRef = useRef<HTMLInputElement>(null);
  const walletSearchRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus desktop amount input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.innerWidth >= 768) {
        desktopAmountRef.current?.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Focus search inputs when subModal opens
  useEffect(() => {
    if (subModal === 'category') setTimeout(() => catSearchRef.current?.focus(), 40);
    if (subModal === 'wallet' || subModal === 'toWallet') setTimeout(() => walletSearchRef.current?.focus(), 40);
    if (subModal === 'note') setTimeout(() => noteInputRef.current?.focus(), 40);
  }, [subModal]);

  const parsedAmount = useMemo(() => parseAmountExpression(expr), [expr]);

  const fromWallet = visibleWallets.find((w) => w.id === walletId) ?? visibleWallets[0];
  const toWallet = visibleWallets.find((w) => w.id === toWalletId) ?? visibleWallets[1] ?? visibleWallets[0];

  const matchingInvestmentProducts = useMemo(() => {
    const invWalletId =
      tab === 'saving'
        ? savingDirection === 'saving'
          ? toWallet?.group === 'investment'
            ? toWallet.id
            : null
          : fromWallet?.group === 'investment'
            ? fromWallet.id
            : null
        : null;
    if (!invWalletId) return [];
    return dataset.investmentProducts.filter((p) => p.walletId === invWalletId);
  }, [dataset.investmentProducts, fromWallet, savingDirection, tab, toWallet]);

  const handleSave = useCallback(() => {
    const amount = parsedAmount.value;
    if (amount <= 0 || !fromWallet) return;

    const txType: TransactionType = tab === 'saving' ? savingDirection : tab;
    const validProductId =
      tab === 'saving' &&
      investmentProductId &&
      matchingInvestmentProducts.some((p) => p.id === investmentProductId)
        ? investmentProductId
        : null;

    const payload = {
      date,
      type: txType,
      subcategoryId: tab === 'transfer' ? null : subId,
      walletId: fromWallet.id,
      toWalletId: tab === 'transfer' || tab === 'saving' ? toWallet?.id ?? null : null,
      amount,
      fee: tab === 'transfer' ? fee : 0,
      goalId: tab === 'saving' ? goalId : null,
      investmentProductId: validProductId,
      note: note.trim(),
    };

    if (isEdit && editTx) {
      updateTransaction({
        ...editTx,
        ...payload,
      });
    } else {
      addTransaction(payload);
    }
    closeQuickInput();
  }, [
    addTransaction,
    closeQuickInput,
    date,
    editTx,
    fee,
    fromWallet,
    goalId,
    investmentProductId,
    isEdit,
    matchingInvestmentProducts,
    note,
    parsedAmount.value,
    savingDirection,
    subId,
    tab,
    toWallet,
    updateTransaction,
  ]);

  // Keyboard Esc & Ctrl+Enter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (subModal) setSubModal(null);
        else closeQuickInput();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !subModal) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeQuickInput, handleSave, subModal]);

  const switchTab = (next: ActiveTab) => {
    setTab(next);
    setSubModal(null);
    if (next === 'transfer') {
      setSubId(null);
      setGoalId(null);
      if (walletId === toWalletId) {
        const alt = visibleWallets.find((w) => w.id !== walletId);
        if (alt) setToWalletId(alt.id);
      }
    } else if (next === 'saving') {
      setSavingDirection('saving');
      const sId = getDefaultSubForType('saving');
      setSubId(sId);
      const matchingGoal = dataset.goals.find((g) => g.subcategoryId === sId);
      setGoalId(matchingGoal?.id ?? null);
      if (walletId === toWalletId || !toWalletId) {
        setWalletId(defaultBankWalletId);
        setToWalletId(defaultInvestWalletId);
      }
    } else {
      setGoalId(null);
      setSubId(getDefaultSubForType(next));
      if (next === 'income') setWalletId(defaultBankWalletId);
    }
  };

  // Budget info for category picker
  const expenseBudgetMap = useMemo(() => {
    const res = calculateCategoryBudgets(
      dataset.categories,
      dataset.subcategories,
      periodTransactions,
      'expense'
    );
    return new Map(res.items.map((item) => [item.category.id, item]));
  }, [dataset, periodTransactions]);

  // Frequent subcategories (from history + smart defaults)
  const frequentSubIds = useMemo(() => {
    const catType = tab === 'transfer' ? 'expense' : tab;
    const counts = new Map<string, number>();
    for (const tx of dataset.transactions) {
      if (!tx.subcategoryId) continue;
      if (catType === 'saving' && (tx.type === 'saving' || tx.type === 'saving_withdrawal')) {
        counts.set(tx.subcategoryId, (counts.get(tx.subcategoryId) ?? 0) + 1);
      } else if (tx.type === catType) {
        counts.set(tx.subcategoryId, (counts.get(tx.subcategoryId) ?? 0) + 1);
      }
    }
    const sorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    const defaultsByName: Record<string, string[]> = {
      expense: ['Kafe', 'Makanan Pokok', 'Bensin', 'Taksi/Ojol', 'Belanja bulanan'],
      income: ['Gaji', 'Bonus', 'Cashback', 'Bunga', 'Pendapatan tambahan'],
      saving: ['Wedding', 'Dana darurat', 'Investasi', 'Rumah/Apartemen', 'Umum'],
    };

    const fallback = (defaultsByName[catType] ?? [])
      .map((name) =>
        dataset.subcategories.find((s) => {
          const c = dataset.categories.find((cat) => cat.id === s.categoryId);
          return c?.type === catType && s.name === name && !s.archived;
        })?.id
      )
      .filter((x): x is string => Boolean(x));

    return [...new Set([...sorted, ...fallback])].slice(0, 5);
  }, [dataset, tab]);

  const selectedSub = subId ? dataset.subcategories.find((s) => s.id === subId) ?? null : null;
  const selectedCat = selectedSub
    ? dataset.categories.find((c) => c.id === selectedSub.categoryId) ?? null
    : null;
  const selectedGoal = goalId ? dataset.goals.find((g) => g.id === goalId) ?? null : null;

  const fromBal = fromWallet ? balanceById.get(fromWallet.id)?.balance ?? 0 : 0;
  const toBal = toWallet ? balanceById.get(toWallet.id)?.balance ?? 0 : 0;

  const deductAmount =
    tab === 'income'
      ? 0
      : tab === 'transfer'
        ? parsedAmount.value + fee
        : parsedAmount.value;

  const projectedFromBal =
    tab === 'income' ? fromBal + parsedAmount.value : fromBal - deductAmount;
  const willGoMinus = tab !== 'income' && parsedAmount.value > 0 && projectedFromBal < 0;

  const pressKey = (k: string) => {
    let e = expr;
    if (k === 'BS') {
      e = e.slice(0, -1);
    } else if (k === '=') {
      const p = parseAmountExpression(e);
      e = p.value ? String(p.value) : '';
    } else if (k === '+' || k === '-') {
      if (!e) return;
      if (/[+-]$/.test(e)) e = e.slice(0, -1) + k;
      else e += k;
    } else if (k === ',') {
      const lastSeg = e.split(/[+-]/).pop() ?? '';
      if (!lastSeg.includes(',')) e += lastSeg ? ',' : '0,';
    } else if (k === 'rb' || k === 'jt') {
      const mult = k === 'jt' ? 1_000_000 : 1_000;
      const m = e.match(/^(.*?)(\d+(?:,\d*)?)$/);
      if (m) {
        const num = parseFloat(m[2].replace(',', '.'));
        if (!Number.isNaN(num)) e = m[1] + String(Math.round(num * mult));
      } else if (!e) {
        e = String(mult);
      }
    } else if (k.startsWith('ADD_')) {
      const inc = Number(k.slice(4));
      e = String(parseAmountExpression(e).value + inc);
    } else {
      if (e === '0' && k !== ',') e = k === '000' ? '0' : k;
      else e += k;
    }
    setExpr(e);
  };

  const applyTemplate = (tplId: string) => {
    const tpl = dataset.templates.find((t) => t.id === tplId);
    if (!tpl) return;
    const nextTab: ActiveTab =
      tpl.type === 'saving_withdrawal'
        ? 'saving'
        : tpl.type === 'income' || tpl.type === 'saving' || tpl.type === 'transfer'
          ? tpl.type
          : 'expense';
    setTab(nextTab);
    setSavingDirection(tpl.type === 'saving_withdrawal' ? 'saving_withdrawal' : 'saving');
    setExpr(String(tpl.amount));
    setSubId(tpl.subcategoryId);
    if (visibleWallets.some((w) => w.id === tpl.walletId)) setWalletId(tpl.walletId);
    if (tpl.toWalletId && visibleWallets.some((w) => w.id === tpl.toWalletId)) {
      setToWalletId(tpl.toWalletId);
    }
    setGoalId(tpl.goalId ?? null);
    setNote(tpl.note);
  };

  const swapWallets = () => {
    const prevFrom = walletId;
    setWalletId(toWalletId);
    setToWalletId(prevFrom);
  };

  const currentTabStyle = TAB_CONFIG[tab];

  // ==================== SUB-MODAL VIEWS ====================

  const renderSubModal = () => {
    if (!subModal) return null;

    if (subModal === 'category') {
      const catType = tab === 'transfer' ? 'expense' : tab;
      const q = catQuery.trim().toLowerCase();
      const showTransferHint =
        q.length > 0 &&
        ('tarik tunai'.includes(q) ||
          'atm'.includes(q) ||
          'top up'.includes(q) ||
          'topup'.includes(q) ||
          'e-money'.includes(q) ||
          'emoney'.includes(q));

      const cats = dataset.categories
        .filter((c) => c.type === catType && !c.archived)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const groups = cats
        .map((cat) => {
          const parentMatch = q && cat.name.toLowerCase().includes(q);
          const subs = dataset.subcategories
            .filter((s) => s.categoryId === cat.id && !s.archived)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .filter((s) => {
              if (!q || parentMatch) return true;
              if (s.name.toLowerCase().includes(q)) return true;
              return s.aliases.some((a) => a.toLowerCase().includes(q));
            });
          return { cat, subs };
        })
        .filter((g) => g.subs.length > 0);

      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--mw-border)]">
            <h3 className="text-sm font-semibold text-[var(--mw-text)]">
              Pilih Kategori ({TAB_CONFIG[catType].label})
            </h3>
            <button
              type="button"
              onClick={() => setSubModal(null)}
              className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative mt-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mw-text-dim)]" />
            <input
              ref={catSearchRef}
              type="text"
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              placeholder="Cari kategori, sub, atau alias (kopi, ojol, kos)..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
            />
            {catQuery && (
              <button
                type="button"
                onClick={() => {
                  setCatQuery('');
                  catSearchRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mw-text-dim)] hover:text-[var(--mw-text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="mt-3 flex-1 overflow-y-auto mw-scroll pr-1 space-y-3">
            {showTransferHint && (
              <div className="p-3 rounded-2xl bg-[var(--mw-primary-soft)] border border-[var(--mw-border)] space-y-2 text-xs">
                <div className="text-[var(--mw-text)] leading-relaxed">
                  <b>Tarik tunai</b> &amp; <b>Top up e-money/e-wallet</b> dicatat sebagai{' '}
                  <b>Transfer</b> agar tidak dihitung ganda sebagai pengeluaran.
                </div>
                <button
                  type="button"
                  onClick={() => switchTab('transfer')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                  style={{ background: 'var(--mw-primary)' }}
                >
                  Pindah ke Mode Transfer
                </button>
              </div>
            )}

            {!q && frequentSubIds.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[var(--mw-text-muted)] px-1">
                  Sering Dipakai
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {frequentSubIds.map((id) => {
                    const s = dataset.subcategories.find((x) => x.id === id);
                    const c = s ? dataset.categories.find((cat) => cat.id === s.categoryId) : null;
                    if (!s || !c) return null;
                    const active = s.id === subId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSubId(s.id);
                          const g = dataset.goals.find((goal) => goal.subcategoryId === s.id);
                          if (tab === 'saving' && g) setGoalId(g.id);
                          setSubModal(null);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 border cursor-pointer transition"
                        style={{
                          background: active ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                          borderColor: active ? 'var(--mw-primary)' : 'var(--mw-border)',
                          color: active ? 'var(--mw-primary)' : 'var(--mw-text)',
                        }}
                      >
                        <DynamicIcon name={c.icon} className="w-3.5 h-3.5" />
                        <span>{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {groups.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--mw-text-muted)]">
                Kategori &ldquo;{catQuery}&rdquo; tidak ditemukan.
              </div>
            ) : (
              groups.map(({ cat, subs }) => {
                const bud = expenseBudgetMap.get(cat.id);
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between px-1.5 py-1 text-xs font-semibold text-[var(--mw-text-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <DynamicIcon name={cat.icon} className="w-3.5 h-3.5" style={{ color: cat.color }} />
                        <span>{cat.name}</span>
                      </span>
                      {bud?.effectiveBudget && (
                        <span
                          className="tab-num"
                          style={{
                            color:
                              bud.status === 'over'
                                ? 'var(--mw-expense)'
                                : bud.status === 'warn'
                                  ? 'var(--mw-warn)'
                                  : 'var(--mw-text-dim)',
                          }}
                        >
                          {formatIDRCompact(bud.actual, privacy)} / {formatIDRCompact(bud.effectiveBudget, privacy)}
                        </span>
                      )}
                    </div>

                    {subs.map((s) => {
                      const active = s.id === subId;
                      const matchedAlias =
                        q &&
                        !s.name.toLowerCase().includes(q) &&
                        !cat.name.toLowerCase().includes(q)
                          ? s.aliases.find((a) => a.toLowerCase().includes(q))
                          : null;
                      const linkedGoal = dataset.goals.find((g) => g.subcategoryId === s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSubId(s.id);
                            if (tab === 'saving' && linkedGoal) setGoalId(linkedGoal.id);
                            setSubModal(null);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left border cursor-pointer transition"
                          style={{
                            background: active ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                            borderColor: active ? 'var(--mw-primary)' : 'transparent',
                          }}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[var(--mw-text)] flex items-center gap-1.5">
                              <span>{s.name}</span>
                              {linkedGoal && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-md"
                                  style={{ background: 'var(--mw-saving-soft)', color: 'var(--mw-saving)' }}
                                >
                                  Goal: {linkedGoal.name}
                                </span>
                              )}
                            </div>
                            {matchedAlias && (
                              <div className="text-xs text-[var(--mw-text-muted)]">
                                Alias: {matchedAlias}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-[var(--mw-text-dim)] tab-num">
                              {s.monthlyBudget
                                ? formatIDRCompact(s.monthlyBudget, privacy)
                                : 'Track'}
                            </span>
                            {active && <Check className="w-4 h-4 text-[var(--mw-primary)]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    if (subModal === 'wallet' || subModal === 'toWallet') {
      const isDest = subModal === 'toWallet';
      const activeId = isDest ? toWalletId : walletId;
      const q = walletQuery.trim().toLowerCase();
      const title = isDest
        ? tab === 'saving'
          ? savingDirection === 'saving'
            ? 'Ke Wallet Tabungan / Aset'
            : 'Ke Wallet Tujuan'
          : 'Transfer Ke Wallet'
        : tab === 'transfer' || tab === 'saving'
          ? 'Dari Wallet'
          : 'Pilih Wallet';

      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--mw-border)]">
            <h3 className="text-sm font-semibold text-[var(--mw-text)]">{title}</h3>
            <button
              type="button"
              onClick={() => setSubModal(null)}
              className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative mt-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mw-text-dim)]" />
            <input
              ref={walletSearchRef}
              type="text"
              value={walletQuery}
              onChange={(e) => setWalletQuery(e.target.value)}
              placeholder="Cari dompet (Jago, GoPay, Bibit, Tunai)..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
            />
          </div>

          <div className="mt-3 flex-1 overflow-y-auto mw-scroll pr-1 space-y-3">
            {!q && recentWalletIds.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[var(--mw-text-muted)] px-1">
                  Terakhir Dipakai
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentWalletIds.map((id) => {
                    const w = visibleWallets.find((x) => x.id === id);
                    if (!w) return null;
                    const active = w.id === activeId;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          if (isDest) setToWalletId(w.id);
                          else setWalletId(w.id);
                          setSubModal(null);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 border cursor-pointer"
                        style={{
                          background: active ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                          borderColor: active ? 'var(--mw-primary)' : 'var(--mw-border)',
                          color: active ? 'var(--mw-primary)' : 'var(--mw-text)',
                        }}
                      >
                        <DynamicIcon name={w.icon} className="w-3.5 h-3.5" style={{ color: w.color }} />
                        <span>{w.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {WALLET_GROUP_ORDER.map((grp) => {
              const items = visibleWalletBalances.filter(
                (b) =>
                  b.wallet.group === grp &&
                  (!q ||
                    b.wallet.name.toLowerCase().includes(q) ||
                    WALLET_GROUP_LABELS[grp].toLowerCase().includes(q))
              );
              if (items.length === 0) return null;
              const subtotal = items.reduce((s, b) => s + b.balance, 0);

              return (
                <div key={grp} className="space-y-1">
                  <div className="flex items-center justify-between px-1.5 py-1 text-xs font-semibold text-[var(--mw-text-muted)]">
                    <span>{WALLET_GROUP_LABELS[grp]}</span>
                    <span className="tab-num text-[var(--mw-text-dim)]">
                      {formatIDR(subtotal, privacy)}
                    </span>
                  </div>
                  {items.map((item) => {
                    const w = item.wallet;
                    const active = w.id === activeId;
                    const amt = parsedAmount.value;
                    const willDeduct = !isDest && tab !== 'income' && amt > 0;
                    const willAdd = (isDest || tab === 'income') && amt > 0;
                    const afterBal = willDeduct
                      ? item.balance - (amt + (tab === 'transfer' ? fee : 0))
                      : willAdd
                        ? item.balance + amt
                        : item.balance;
                    const minus = willDeduct && afterBal < 0;

                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          if (isDest) {
                            setToWalletId(w.id);
                            if (w.id === walletId) {
                              const alt = visibleWallets.find((x) => x.id !== w.id);
                              if (alt) setWalletId(alt.id);
                            }
                          } else {
                            setWalletId(w.id);
                            if ((tab === 'transfer' || tab === 'saving') && w.id === toWalletId) {
                              const alt = visibleWallets.find((x) => x.id !== w.id);
                              if (alt) setToWalletId(alt.id);
                            }
                          }
                          setSubModal(null);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left border cursor-pointer transition"
                        style={{
                          background: active ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                          borderColor: active ? 'var(--mw-primary)' : 'transparent',
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${w.color}22`, color: w.color }}
                          >
                            <DynamicIcon name={w.icon} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[var(--mw-text)] truncate">
                              {w.name}
                            </div>
                            {amt > 0 && (
                              <div
                                className="text-xs tab-num"
                                style={{ color: minus ? 'var(--mw-warn)' : 'var(--mw-text-dim)' }}
                              >
                                {minus ? 'Akan minus: ' : 'Sesudah: '}
                                {formatIDR(afterBal, privacy)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold tab-num text-[var(--mw-text)]">
                            {formatIDR(item.balance, privacy)}
                          </div>
                          {active && (
                            <div className="text-xs font-semibold text-[var(--mw-primary)]">Dipilih</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (subModal === 'date') {
      const refDate = new Date(`${today}T00:00:00`);
      const yest = new Date(refDate);
      yest.setDate(refDate.getDate() - 1);
      const twoAgo = new Date(refDate);
      twoAgo.setDate(refDate.getDate() - 2);

      const shortcuts = [
        { label: 'Hari ini', iso: today },
        { label: 'Kemarin', iso: toISODate(yest) },
        { label: '2 hari lalu', iso: toISODate(twoAgo) },
      ];

      const firstDow = new Date(calYear, calMonth, 1).getDay();
      const offset = (firstDow + 6) % 7;
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--mw-border)]">
            <h3 className="text-sm font-semibold text-[var(--mw-text)]">Pilih Tanggal</h3>
            <button
              type="button"
              onClick={() => setSubModal(null)}
              className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {shortcuts.map((s) => {
              const active = date === s.iso;
              return (
                <button
                  key={s.iso}
                  type="button"
                  onClick={() => {
                    setDate(s.iso);
                    setSubModal(null);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer"
                  style={{
                    background: active ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                    borderColor: active ? 'var(--mw-primary)' : 'var(--mw-border)',
                    color: active ? 'var(--mw-primary)' : 'var(--mw-text)',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear((y) => y - 1);
                  } else setCalMonth((m) => m - 1);
                }}
                className="w-8 h-8 rounded-lg bg-[var(--mw-surface-3)] flex items-center justify-center text-[var(--mw-text)] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-semibold text-[var(--mw-text)]">
                {formatMonthYearID(calYear, calMonth)}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear((y) => y + 1);
                  } else setCalMonth((m) => m + 1);
                }}
                className="w-8 h-8 rounded-lg bg-[var(--mw-surface-3)] flex items-center justify-center text-[var(--mw-text)] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--mw-text-dim)] mb-1.5">
              {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: offset }).map((_, idx) => (
                <div key={`empty-${idx}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const active = date === iso;
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => {
                      setDate(iso);
                      setSubModal(null);
                    }}
                    className="h-9 rounded-xl text-xs font-medium tab-num cursor-pointer transition border"
                    style={{
                      background: active
                        ? 'var(--mw-primary)'
                        : isToday
                          ? 'var(--mw-primary-soft)'
                          : 'transparent',
                      color: active
                        ? '#ffffff'
                        : isToday
                          ? 'var(--mw-primary)'
                          : 'var(--mw-text)',
                      borderColor: isToday && !active ? 'var(--mw-primary)' : 'transparent',
                    }}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (subModal === 'note') {
      const suggestions =
        selectedSub && selectedSub.defaultNotes.length > 0
          ? selectedSub.defaultNotes
          : tab === 'transfer'
            ? ['Top up GoPay', 'Tarik tunai ATM', 'Top up Mandiri e-money', 'Pindah dana']
            : [];

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--mw-border)]">
            <h3 className="text-sm font-semibold text-[var(--mw-text)]">Catatan Transaksi</h3>
            <button
              type="button"
              onClick={() => setSubModal(null)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
              style={{ background: 'var(--mw-primary)' }}
            >
              Selesai
            </button>
          </div>

          <div>
            <textarea
              ref={noteInputRef}
              rows={3}
              maxLength={140}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tulis catatan (opsional, juga berguna untuk pencarian & saran AI)..."
              className="w-full p-3 rounded-2xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)] resize-none"
            />
            <div className="text-right text-xs text-[var(--mw-text-dim)] tab-num mt-1">
              {note.length}/140
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[var(--mw-text-muted)]">
                Saran cepat {selectedSub ? `untuk ${selectedSub.name}` : ''}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setNote(s);
                      setSubModal(null);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] text-[var(--mw-text)] cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
                {note && (
                  <button
                    type="button"
                    onClick={() => setNote('')}
                    className="px-3 py-1.5 rounded-xl text-xs text-[var(--mw-text-muted)] border border-[var(--mw-border)] cursor-pointer"
                  >
                    Kosongkan
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (subModal === 'goal') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--mw-border)]">
            <h3 className="text-sm font-semibold text-[var(--mw-text)]">Hubungkan ke Target Tabungan</h3>
            <button
              type="button"
              onClick={() => setSubModal(null)}
              className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setGoalId(null);
              setSubModal(null);
            }}
            className="w-full p-3 rounded-xl text-left border cursor-pointer"
            style={{
              background: !goalId ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
              borderColor: !goalId ? 'var(--mw-primary)' : 'transparent',
            }}
          >
            <div className="text-sm font-medium text-[var(--mw-text)]">Tanpa Goal tertentu</div>
            <div className="text-xs text-[var(--mw-text-muted)]">Dicatat sebagai Saving umum</div>
          </button>
          {dataset.goals
            .filter((g) => g.status === 'active')
            .map((g) => {
              const active = goalId === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGoalId(g.id);
                    if (g.subcategoryId) setSubId(g.subcategoryId);
                    if (g.walletId && visibleWallets.some((w) => w.id === g.walletId)) {
                      setToWalletId(g.walletId);
                    }
                    setSubModal(null);
                  }}
                  className="w-full p-3 rounded-xl text-left border cursor-pointer flex items-center justify-between gap-2"
                  style={{
                    background: active ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                    borderColor: active ? 'var(--mw-primary)' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${g.color}22`, color: g.color }}
                    >
                      <DynamicIcon name={g.icon} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--mw-text)] truncate">
                        {g.name} {g.isShared ? '· Bersama' : ''}
                      </div>
                      <div className="text-xs text-[var(--mw-text-muted)] tab-num">
                        Target {formatIDR(g.targetAmount, privacy)}
                      </div>
                    </div>
                  </div>
                  {active && <Check className="w-4 h-4 text-[var(--mw-primary)] shrink-0" />}
                </button>
              );
            })}
        </div>
      );
    }

    return null;
  };

  // ==================== SHARED FORM FIELDS ====================

  const renderFormFields = () => (
    <div className="space-y-2">
      {tab === 'saving' && (
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--mw-surface-2)] text-xs font-medium">
          <button
            type="button"
            onClick={() => setSavingDirection('saving')}
            className="py-1.5 rounded-lg cursor-pointer transition"
            style={{
              background: savingDirection === 'saving' ? 'var(--mw-saving-soft)' : 'transparent',
              color: savingDirection === 'saving' ? 'var(--mw-saving)' : 'var(--mw-text-muted)',
            }}
          >
            Setor Tabungan
          </button>
          <button
            type="button"
            onClick={() => setSavingDirection('saving_withdrawal')}
            className="py-1.5 rounded-lg cursor-pointer transition"
            style={{
              background:
                savingDirection === 'saving_withdrawal' ? 'var(--mw-warn-soft)' : 'transparent',
              color:
                savingDirection === 'saving_withdrawal' ? 'var(--mw-warn)' : 'var(--mw-text-muted)',
            }}
          >
            Tarik Tabungan
          </button>
        </div>
      )}

      {tab === 'transfer' ? (
        <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubModal('wallet')}
              className="flex-1 p-2.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-left min-w-0 cursor-pointer hover:border-[var(--mw-primary)] transition"
            >
              <div className="text-xs text-[var(--mw-text-dim)]">Dari Wallet</div>
              <div className="text-sm font-semibold text-[var(--mw-text)] truncate mt-0.5">
                {fromWallet?.name}
              </div>
              <div className="text-xs text-[var(--mw-text-muted)] tab-num">
                {formatIDR(fromBal, privacy)}
              </div>
            </button>

            <button
              type="button"
              onClick={swapWallets}
              aria-label="Tukar wallet asal dan tujuan"
              className="w-9 h-9 rounded-full bg-[var(--mw-surface-3)] border border-[var(--mw-border)] flex items-center justify-center text-[var(--mw-text)] shrink-0 cursor-pointer hover:border-[var(--mw-primary)] transition"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSubModal('toWallet')}
              className="flex-1 p-2.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-left min-w-0 cursor-pointer hover:border-[var(--mw-primary)] transition"
            >
              <div className="text-xs text-[var(--mw-text-dim)]">Ke Wallet</div>
              <div className="text-sm font-semibold text-[var(--mw-text)] truncate mt-0.5">
                {toWallet?.name}
              </div>
              <div className="text-xs text-[var(--mw-text-muted)] tab-num">
                {formatIDR(toBal, privacy)}
              </div>
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--mw-border)] text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[var(--mw-text-muted)]">Biaya admin:</span>
              <div className="flex flex-wrap items-center gap-1">
                {[0, 2500, 6500].map((f) => {
                  const active = !customFeeMode && fee === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setCustomFeeMode(false);
                        setFee(f);
                        setCustomFeeText('');
                      }}
                      className="px-2.5 py-1 rounded-lg border cursor-pointer tab-num"
                      style={{
                        background: active ? 'var(--mw-primary-soft)' : 'var(--mw-surface)',
                        borderColor: active ? 'var(--mw-primary)' : 'var(--mw-border)',
                        color: active ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
                      }}
                    >
                      {f === 0 ? 'Gratis' : formatIDR(f)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setCustomFeeMode(true);
                    if (!customFeeText && fee > 0) setCustomFeeText(String(fee));
                  }}
                  className="px-2.5 py-1 rounded-lg border cursor-pointer font-medium"
                  style={{
                    background: customFeeMode ? 'var(--mw-primary-soft)' : 'var(--mw-surface)',
                    borderColor: customFeeMode ? 'var(--mw-primary)' : 'var(--mw-border)',
                    color: customFeeMode ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
                  }}
                >
                  Custom
                </button>
              </div>
            </div>

            {customFeeMode && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-primary)]">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-[var(--mw-text-dim)] font-semibold">Rp</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={customFeeText}
                    onChange={(e) => {
                      setCustomFeeText(e.target.value);
                      setFee(parseAmountExpression(e.target.value).value);
                    }}
                    placeholder="Ketik nominal (mis. 1500 atau 4rb)"
                    className="w-full bg-transparent text-xs font-semibold tab-num text-[var(--mw-text)] focus:outline-none"
                  />
                </div>
                {fee > 0 && (
                  <span className="text-xs font-bold tab-num text-[var(--mw-primary)] shrink-0">
                    = {formatIDR(fee)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--mw-text-muted)]">
            <Info className="w-3.5 h-3.5 shrink-0 text-[var(--mw-primary)]" />
            <span>
              Biaya admin{fee > 0 ? ` (${formatIDR(fee)})` : ''} masuk ke Expense: Lainnya &gt; Biaya
            </span>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSubModal('category')}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] hover:border-[var(--mw-primary)] flex items-center justify-between gap-2 text-left cursor-pointer transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: selectedCat ? `${selectedCat.color}22` : 'var(--mw-surface-3)',
                  color: selectedCat ? selectedCat.color : 'var(--mw-text-muted)',
                }}
              >
                <DynamicIcon name={selectedCat?.icon ?? 'tag'} className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-[var(--mw-text-dim)]">Kategori</div>
                <div className="text-sm font-medium text-[var(--mw-text)] truncate">
                  {selectedCat && selectedSub
                    ? `${selectedCat.name} › ${selectedSub.name}`
                    : 'Pilih kategori...'}
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-[var(--mw-surface-3)] text-[var(--mw-text-muted)] shrink-0">
              <Search className="w-3 h-3" />
              Cari
            </span>
          </button>

          {tab === 'saving' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubModal('wallet')}
                  className="px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] hover:border-[var(--mw-primary)] text-left min-w-0 cursor-pointer transition"
                >
                  <div className="text-xs text-[var(--mw-text-dim)]">
                    {savingDirection === 'saving' ? 'Dari Wallet' : 'Dari Aset Tabungan'}
                  </div>
                  <div className="text-xs font-semibold text-[var(--mw-text)] truncate mt-0.5">
                    {fromWallet?.name}
                  </div>
                  <div className="text-xs text-[var(--mw-text-muted)] tab-num">
                    {formatIDR(fromBal, privacy)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSubModal('toWallet')}
                  className="px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] hover:border-[var(--mw-primary)] text-left min-w-0 cursor-pointer transition"
                >
                  <div className="text-xs text-[var(--mw-text-dim)]">
                    {savingDirection === 'saving' ? 'Ke Aset / Tabungan' : 'Ke Wallet Tujuan'}
                  </div>
                  <div className="text-xs font-semibold text-[var(--mw-text)] truncate mt-0.5">
                    {toWallet?.name}
                  </div>
                  <div className="text-xs text-[var(--mw-text-muted)] tab-num">
                    {formatIDR(toBal, privacy)}
                  </div>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSubModal('goal')}
                className="w-full px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] hover:border-[var(--mw-primary)] flex items-center justify-between gap-2 text-left cursor-pointer transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="w-4 h-4 shrink-0 text-[var(--mw-saving)]" />
                  <span className="text-xs font-medium text-[var(--mw-text)] truncate">
                    {selectedGoal
                      ? `Goal: ${selectedGoal.name}${selectedGoal.isShared ? ' (Bersama)' : ''}`
                      : 'Hubungkan ke Goal (opsional)'}
                  </span>
                </div>
                <span className="text-xs text-[var(--mw-text-muted)] shrink-0">Ubah</span>
              </button>
              {matchingInvestmentProducts.length > 0 && (
                <div className="p-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[var(--mw-text-dim)]">
                    <span>Produk Bibit (otomatis update modal &amp; nilai pasar):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchingInvestmentProducts.map((p) => {
                      const active = investmentProductId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setInvestmentProductId(active ? null : p.id)}
                          className="px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition"
                          style={{
                            background: active ? `${p.color}22` : 'var(--mw-surface)',
                            borderColor: active ? p.color : 'var(--mw-border)',
                            color: active ? p.color : 'var(--mw-text-muted)',
                          }}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSubModal('wallet')}
                className="px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] hover:border-[var(--mw-primary)] text-left min-w-0 cursor-pointer transition"
              >
                <div className="text-xs text-[var(--mw-text-dim)]">Wallet</div>
                <div className="text-xs font-semibold text-[var(--mw-text)] truncate mt-0.5">
                  {fromWallet?.name}
                </div>
                <div className="text-xs text-[var(--mw-text-muted)] tab-num">
                  {formatIDR(fromBal, privacy)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSubModal('date')}
                className="px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] hover:border-[var(--mw-primary)] text-left min-w-0 cursor-pointer transition"
              >
                <div className="text-xs text-[var(--mw-text-dim)]">Tanggal</div>
                <div className="text-xs font-semibold text-[var(--mw-text)] truncate mt-0.5 inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                  <span>{formatDateID(date, today)}</span>
                </div>
                <div className="text-xs text-[var(--mw-text-muted)]">Tap untuk ubah</div>
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'transfer' || tab === 'saving' ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSubModal('date')}
            className="px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] hover:border-[var(--mw-primary)] text-left min-w-0 cursor-pointer transition"
          >
            <div className="text-xs text-[var(--mw-text-dim)]">Tanggal</div>
            <div className="text-xs font-semibold text-[var(--mw-text)] truncate mt-0.5 inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
              <span>{formatDateID(date, today)}</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSubModal('note')}
            className="px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] hover:border-[var(--mw-primary)] text-left min-w-0 cursor-pointer transition"
          >
            <div className="text-xs text-[var(--mw-text-dim)]">Catatan</div>
            <div className="text-xs font-medium text-[var(--mw-text)] truncate mt-0.5">
              {note || 'Tambah catatan...'}
            </div>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSubModal('note')}
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] hover:border-[var(--mw-primary)] flex items-center justify-between gap-2 text-left cursor-pointer transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 shrink-0 text-[var(--mw-text-dim)]" />
            <span
              className={`text-xs truncate ${
                note ? 'font-medium text-[var(--mw-text)]' : 'text-[var(--mw-text-muted)]'
              }`}
            >
              {note || 'Tambah catatan (opsional)...'}
            </span>
          </div>
          <span className="text-xs text-[var(--mw-text-dim)] shrink-0">
            {note ? 'Edit' : 'Tulis'}
          </span>
        </button>
      )}
    </div>
  );

  // ==================== RENDER SHELL (Mobile Sheet vs Desktop Side Panel) ====================

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end"
      style={{ background: 'var(--mw-backdrop)' }}
    >
      {/* Backdrop click closes */}
      <div className="flex-1" onClick={closeQuickInput} />

      {/* Container */}
      <div className="relative w-full md:w-[440px] max-h-[94dvh] md:max-h-none md:h-full bg-[var(--mw-surface)] rounded-t-3xl md:rounded-none md:border-l border-t md:border-t-0 border-[var(--mw-border)] flex flex-col animate-sheet-up md:animate-panel-right overflow-hidden">
        {/* Mobile grab handle */}
        <div className="md:hidden pt-2.5 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-[var(--mw-border)]" />
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between px-5 py-4 border-b border-[var(--mw-border)]">
          <div>
            <h2 className="text-base font-bold text-[var(--mw-text)]">
              {isEdit ? 'Edit Transaksi' : 'Input Transaksi Cepat'}
            </h2>
            <p className="text-xs text-[var(--mw-text-muted)]">
              Shortcut: ketik 25rb, 1,5jt, atau 45k+12k · Ctrl+Enter simpan
            </p>
          </div>
          <button
            type="button"
            onClick={closeQuickInput}
            aria-label="Tutup panel"
            className="p-2 rounded-xl bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Scrollable Body */}
        <div className="flex-1 overflow-y-auto mw-scroll px-4 md:px-5 py-3 md:py-4 space-y-3">
          {/* Segmented Type Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
            {(['expense', 'income', 'saving', 'transfer'] as ActiveTab[]).map((t) => {
              const cfg = TAB_CONFIG[t];
              const active = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  className="py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                  style={{
                    background: active ? cfg.soft : 'transparent',
                    color: active ? cfg.color : 'var(--mw-text-muted)',
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* MOBILE AMOUNT DISPLAY (Custom Numpad Driven — No Confusing Text Hint) */}
          <div className="md:hidden text-center py-1">
            {parsedAmount.isExpression ? (
              <div className="text-xs text-[var(--mw-text-muted)] tab-num">
                {parsedAmount.displayExpression} =
              </div>
            ) : parsedAmount.hasPendingDecimal ? (
              <div className="text-xs text-[var(--mw-primary)]">
                Tap <b>×jt</b> atau <b>×rb</b> untuk mengalikan
              </div>
            ) : (
              <div className="text-xs text-[var(--mw-text-dim)]">{currentTabStyle.label}</div>
            )}
            <div
              className="text-3xl font-bold tab-num tracking-tight mt-0.5"
              style={{
                color: parsedAmount.value > 0 ? currentTabStyle.color : 'var(--mw-text-dim)',
              }}
            >
              {parsedAmount.hasPendingDecimal
                ? `Rp${parsedAmount.rawTrimmed}`
                : formatIDR(parsedAmount.value)}
            </div>
          </div>

          {/* DESKTOP AMOUNT INPUT (Keyboard Driven — Supports 25rb, 1,5jt, 45k+12k) */}
          <div className="hidden md:block p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-1.5">
            <label
              htmlFor="desktop-amount-input"
              className="text-xs font-medium text-[var(--mw-text-muted)] block"
            >
              Nominal
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[var(--mw-text-muted)]">Rp</span>
              <input
                ref={desktopAmountRef}
                id="desktop-amount-input"
                type="text"
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                placeholder="25rb, 1,5jt, atau 45k+12k"
                className="w-full bg-transparent text-2xl font-bold tab-num text-[var(--mw-text)] focus:outline-none"
              />
            </div>
            <div className="text-xs">
              {!parsedAmount.rawTrimmed ? (
                <span className="text-[var(--mw-text-dim)]">
                  Contoh: <b>25rb</b>, <b>1,5jt</b>, atau <b>45k+12k</b>
                </span>
              ) : /[a-z,+-]/i.test(parsedAmount.rawTrimmed) ? (
                <span className="font-semibold tab-num text-[var(--mw-primary)]">
                  = {formatIDR(parsedAmount.value)}
                </span>
              ) : (
                <span className="text-[var(--mw-text-muted)] tab-num">
                  {formatIDR(parsedAmount.value)}
                </span>
              )}
            </div>
          </div>

          {/* Minus balance warning */}
          {willGoMinus && (
            <div
              className="px-3 py-2 rounded-xl text-xs flex items-center gap-2"
              style={{ background: 'var(--mw-warn-soft)', color: 'var(--mw-warn)' }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Saldo <b>{fromWallet?.name}</b> akan menjadi{' '}
                <b className="tab-num">{formatIDR(projectedFromBal, privacy)}</b>
              </span>
            </div>
          )}

          {/* Fields */}
          {renderFormFields()}

          {/* Quick Favorite Templates */}
          {!isEdit && dataset.templates.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto mw-scroll pb-0.5">
              {dataset.templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] border border-[var(--mw-border)] shrink-0 cursor-pointer transition"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* MOBILE CUSTOM NUMPAD FOOTER */}
        <div className="md:hidden px-4 pt-2 pb-safe border-t border-[var(--mw-border)] bg-[var(--mw-surface)] space-y-2">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => pressKey('rb')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ background: 'var(--mw-primary-soft)', color: 'var(--mw-primary)' }}
              >
                ×rb
              </button>
              <button
                type="button"
                onClick={() => pressKey('jt')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ background: 'var(--mw-primary-soft)', color: 'var(--mw-primary)' }}
              >
                ×jt
              </button>
            </div>
            <div className="flex items-center gap-1">
              {[
                { label: '+10rb', key: 'ADD_10000' },
                { label: '+50rb', key: 'ADD_50000' },
                { label: '+100rb', key: 'ADD_100000' },
              ].map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => pressKey(b.key)}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium tab-num bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] cursor-pointer active:scale-95 transition"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {['7', '8', '9', 'BS', '4', '5', '6', '+', '1', '2', '3', '-', '000', '0', ',', '='].map(
              (k) => {
                const isOp = ['BS', '+', '-', '='].includes(k);
                const label = k === 'BS' ? '⌫' : k === '-' ? '−' : k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pressKey(k)}
                    className="h-11 rounded-xl text-base font-semibold cursor-pointer active:scale-95 transition"
                    style={
                      isOp
                        ? { background: 'var(--mw-primary-soft)', color: 'var(--mw-primary)' }
                        : {
                            background: 'var(--mw-surface-2)',
                            color: 'var(--mw-text)',
                            border: '1px solid var(--mw-border)',
                          }
                    }
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>

          <button
            type="button"
            disabled={parsedAmount.value <= 0}
            onClick={handleSave}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white cursor-pointer transition disabled:opacity-40"
            style={{ background: 'var(--mw-primary)' }}
          >
            {isEdit ? 'Simpan Perubahan' : `Simpan ${currentTabStyle.label}`}
            {parsedAmount.value > 0 ? ` · ${formatIDR(parsedAmount.value)}` : ''}
          </button>
        </div>

        {/* DESKTOP SAVE FOOTER */}
        <div className="hidden md:flex items-center gap-2 px-5 py-4 border-t border-[var(--mw-border)] bg-[var(--mw-surface)]">
          <button
            type="button"
            onClick={closeQuickInput}
            className="px-4 py-3 rounded-xl text-sm font-medium bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] text-[var(--mw-text)] cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={parsedAmount.value <= 0}
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer transition disabled:opacity-40"
            style={{ background: 'var(--mw-primary)' }}
          >
            {isEdit ? 'Simpan Perubahan' : `Simpan ${currentTabStyle.label}`}
            {parsedAmount.value > 0 ? ` · ${formatIDR(parsedAmount.value)}` : ''}
          </button>
        </div>

        {/* NESTED PICKER OVERLAY */}
        {subModal && (
          <div className="absolute inset-0 z-20 bg-[var(--mw-surface)] p-4 md:p-5 flex flex-col animate-sheet-up">
            {renderSubModal()}
          </div>
        )}
      </div>
    </div>
  );
}
