import type {
  Category,
  CategoryBudgetStatus,
  Goal,
  PeriodPreset,
  PeriodSummary,
  Subcategory,
  Transaction,
  Wallet,
  WalletBalanceSummary,
  WalletValuation,
} from '@/types/finance';

// ==================== FORMATTING ====================

export function formatIDR(amount: number, privacyMode = false): string {
  if (privacyMode) return 'Rp•••••';
  const rounded = Math.round(amount || 0);
  const neg = rounded < 0;
  const formatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-Rp' : 'Rp'}${formatted}`;
}

export function formatIDRCompact(amount: number, privacyMode = false): string {
  if (privacyMode) return 'Rp•••';
  const abs = Math.abs(amount || 0);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')}M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')}jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp${Math.round(abs / 1_000)}rb`;
  }
  return `${sign}Rp${Math.round(abs)}`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function formatDateID(isoDate: string, referenceToday?: string): string {
  if (referenceToday) {
    if (isoDate === referenceToday) {
      const [, m, d] = isoDate.split('-').map(Number);
      return `Hari ini, ${d} ${MONTHS_SHORT[m - 1]}`;
    }
    const ref = new Date(`${referenceToday}T00:00:00`);
    const yest = new Date(ref);
    yest.setDate(ref.getDate() - 1);
    const yestIso = toISODate(yest);
    if (isoDate === yestIso) {
      const [, m, d] = isoDate.split('-').map(Number);
      return `Kemarin, ${d} ${MONTHS_SHORT[m - 1]}`;
    }
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function formatMonthYearID(year: number, monthIndex0: number): string {
  return `${MONTHS_LONG[monthIndex0]} ${year}`;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ==================== AMOUNT EXPRESSION PARSER ====================

export interface ParsedAmount {
  value: number;
  isExpression: boolean;
  displayExpression: string;
  hasPendingDecimal: boolean;
  rawTrimmed: string;
}

/**
 * Parses Rupiah shorthand & simple +/- expressions:
 * - "25rb", "25k", "25ribu" -> 25000
 * - "1,5jt", "1.5jt", "1,5juta" -> 1500000
 * - "45k+12k", "45000+12000" -> 57000
 * - "100rb-15rb" -> 85000
 */
export function parseAmountExpression(raw: string): ParsedAmount {
  if (!raw || !raw.trim()) {
    return {
      value: 0,
      isExpression: false,
      displayExpression: '',
      hasPendingDecimal: false,
      rawTrimmed: '',
    };
  }

  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '');
  const expanded = cleaned.replace(
    /(\d+(?:[.,]\d+)?)(jt|juta|rb|ribu|k)/g,
    (_, num: string, unit: string) => {
      const f = parseFloat(num.replace(',', '.'));
      if (Number.isNaN(f)) return '0';
      const mult = unit === 'jt' || unit === 'juta' ? 1_000_000 : 1_000;
      return String(Math.round(f * mult));
    }
  );

  const tokens = expanded.match(/[+-]?[^+-]+/g);
  if (!tokens) {
    return {
      value: 0,
      isExpression: false,
      displayExpression: '',
      hasPendingDecimal: false,
      rawTrimmed: cleaned,
    };
  }

  let total = 0;
  for (const tok of tokens) {
    let t = tok;
    let sign = 1;
    if (t.startsWith('+')) t = t.slice(1);
    else if (t.startsWith('-')) {
      sign = -1;
      t = t.slice(1);
    }
    if (!t) continue;
    const normalized = t.includes(',')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/\./g, '');
    const val = parseFloat(normalized);
    if (!Number.isNaN(val)) {
      total += sign * val;
    }
  }

  const hasOp = /[+-]/.test(cleaned.slice(1));
  const displayExpression = cleaned
    .replace(/(\d+)/g, (m) =>
      m.length >= 4 && !cleaned.includes(',')
        ? m.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
        : m
    )
    .replace(/\+/g, ' + ')
    .replace(/-/g, ' − ');

  return {
    value: Math.max(0, Math.round(total)),
    isExpression: hasOp,
    displayExpression,
    hasPendingDecimal: /,\d*$/.test(cleaned),
    rawTrimmed: cleaned,
  };
}

// ==================== WALLET BALANCES & NET WORTH ====================

/**
 * Computes exact live balance for every wallet from openingBalance + transactions
 * (Blueprint §2: single source of truth, transfer excluded from expense, transfer fee deducted from source).
 * For investment wallets with valuation snapshots:
 *   marketBalance = latestSnapshot.marketValue + net flows strictly AFTER snapshot.date
 */
export function calculateWalletBalances(
  wallets: Wallet[],
  transactions: Transaction[],
  valuations: WalletValuation[] = []
): WalletBalanceSummary[] {
  const deltaMap = new Map<string, number>();
  for (const w of wallets) {
    deltaMap.set(w.id, 0);
  }

  const addDelta = (walletId: string, delta: number) => {
    deltaMap.set(walletId, (deltaMap.get(walletId) ?? 0) + delta);
  };

  for (const tx of transactions) {
    switch (tx.type) {
      case 'income':
        addDelta(tx.walletId, tx.amount);
        break;
      case 'expense':
        addDelta(tx.walletId, -tx.amount);
        break;
      case 'adjustment':
        addDelta(tx.walletId, tx.amount);
        break;
      case 'transfer':
      case 'saving':
      case 'saving_withdrawal':
        addDelta(tx.walletId, -(tx.amount + (tx.fee || 0)));
        if (tx.toWalletId) {
          addDelta(tx.toWalletId, tx.amount);
        }
        break;
    }
  }

  return wallets.map((wallet) => {
    const costBasis = wallet.openingBalance + (deltaMap.get(wallet.id) ?? 0);

    // Check investment valuations
    const walletVals = valuations
      .filter((v) => v.walletId === wallet.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (wallet.group === 'investment' && walletVals.length > 0) {
      const latest = walletVals[0];
      let postSnapshotFlows = 0;
      for (const tx of transactions) {
        if (tx.date <= latest.date) continue;
        if (tx.type === 'income' && tx.walletId === wallet.id) postSnapshotFlows += tx.amount;
        else if (tx.type === 'expense' && tx.walletId === wallet.id) postSnapshotFlows -= tx.amount;
        else if (tx.type === 'adjustment' && tx.walletId === wallet.id) postSnapshotFlows += tx.amount;
        else if (tx.type === 'transfer' || tx.type === 'saving' || tx.type === 'saving_withdrawal') {
          if (tx.walletId === wallet.id) postSnapshotFlows -= tx.amount + (tx.fee || 0);
          if (tx.toWalletId === wallet.id) postSnapshotFlows += tx.amount;
        }
      }
      const balance = latest.marketValue + postSnapshotFlows;
      const unrealizedGain = balance - costBasis;
      const unrealizedGainPct = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : null;
      return {
        wallet,
        costBasis,
        balance,
        unrealizedGain,
        unrealizedGainPct,
        lastValuationDate: latest.date,
      };
    }

    return {
      wallet,
      costBasis,
      balance: costBasis,
      unrealizedGain: 0,
      unrealizedGainPct: null,
      lastValuationDate: null,
    };
  });
}

export function calculateNetWorth(balances: WalletBalanceSummary[]) {
  let liquid = 0;
  let investment = 0;
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const item of balances) {
    if (!item.wallet.includeInTotal || item.wallet.archived || item.wallet.hidden) continue;
    if (item.wallet.kind === 'liability') {
      // Liability balance stored as negative (debt) or positive owed; treat negative balance as liability magnitude
      totalLiabilities += Math.abs(Math.min(0, item.balance));
    } else {
      totalAssets += item.balance;
      if (item.wallet.group === 'investment') {
        investment += item.balance;
      } else {
        liquid += item.balance;
      }
    }
  }

  return {
    liquid,
    investment,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}

// ==================== PERIOD FILTERING & SUMMARY ====================

export function getPeriodRange(
  preset: PeriodPreset,
  referenceDate = new Date()
): { start: string | null; end: string | null; label: string } {
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();

  if (preset === 'this_month') {
    const start = toISODate(new Date(y, m, 1));
    const end = toISODate(new Date(y, m + 1, 0));
    return { start, end, label: formatMonthYearID(y, m) };
  }
  if (preset === 'last_month') {
    const prev = new Date(y, m - 1, 1);
    const start = toISODate(prev);
    const end = toISODate(new Date(prev.getFullYear(), prev.getMonth() + 1, 0));
    return { start, end, label: formatMonthYearID(prev.getFullYear(), prev.getMonth()) };
  }
  if (preset === 'last_3_months') {
    const start = toISODate(new Date(y, m - 2, 1));
    const end = toISODate(new Date(y, m + 1, 0));
    return { start, end, label: '3 Bulan Terakhir' };
  }
  if (preset === 'this_year') {
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: `Tahun ${y}` };
  }
  return { start: null, end: null, label: 'Semua Waktu' };
}

export function filterTransactionsByRange(
  transactions: Transaction[],
  start: string | null,
  end: string | null
): Transaction[] {
  return transactions.filter((tx) => {
    if (start && tx.date < start) return false;
    if (end && tx.date > end) return false;
    return true;
  });
}

/**
 * Computes Income, Expense, Saving Net, Net Cashflow, and Savings Rate.
 * Blueprint §2 rules:
 * - Transfer principal does NOT count as Income or Expense.
 * - Transfer admin fee DOES count as Expense.
 * - Saving does NOT count as Expense, counts positively toward Savings Rate.
 * - Saving Withdrawal reduces Savings Rate.
 * - Adjustment is tracked separately, excluded from Income/Expense.
 */
export function calculatePeriodSummary(transactions: Transaction[]): PeriodSummary {
  let income = 0;
  let expense = 0;
  let saving = 0;
  let savingWithdrawal = 0;
  let transferVolume = 0;
  let adjustmentNet = 0;

  for (const tx of transactions) {
    switch (tx.type) {
      case 'income':
        income += tx.amount;
        break;
      case 'expense':
        expense += tx.amount;
        break;
      case 'saving':
        saving += tx.amount;
        if (tx.fee > 0) expense += tx.fee;
        break;
      case 'saving_withdrawal':
        savingWithdrawal += tx.amount;
        if (tx.fee > 0) expense += tx.fee;
        break;
      case 'transfer':
        transferVolume += tx.amount;
        if (tx.fee > 0) expense += tx.fee;
        break;
      case 'adjustment':
        adjustmentNet += tx.amount;
        break;
    }
  }

  const savingNet = saving - savingWithdrawal;
  const netCashflow = income - expense;
  const disposableLeft = income - expense - savingNet;
  const savingsRate = income > 0 ? Math.round((savingNet / income) * 1000) / 10 : 0;

  return {
    income,
    expense,
    savingNet,
    netCashflow,
    disposableLeft,
    savingsRate,
    transferVolume,
    adjustmentNet,
  };
}

// ==================== BUDGETS (INTERPRETASI B) ====================

export function calculateCategoryBudgets(
  categories: Category[],
  subcategories: Subcategory[],
  transactions: Transaction[],
  type: 'expense' | 'saving' = 'expense'
): {
  items: CategoryBudgetStatus[];
  totalEffectiveBudget: number;
  totalActual: number;
} {
  const spentBySub = new Map<string, number>();
  let transferFeeExpense = 0;

  for (const tx of transactions) {
    if (type === 'expense') {
      if (tx.type === 'expense' && tx.subcategoryId) {
        spentBySub.set(tx.subcategoryId, (spentBySub.get(tx.subcategoryId) ?? 0) + tx.amount);
      }
      if (tx.type === 'transfer' && tx.fee > 0) {
        transferFeeExpense += tx.fee;
      }
    } else if (type === 'saving') {
      if (tx.type === 'saving' && tx.subcategoryId) {
        spentBySub.set(tx.subcategoryId, (spentBySub.get(tx.subcategoryId) ?? 0) + tx.amount);
      } else if (tx.type === 'saving_withdrawal' && tx.subcategoryId) {
        spentBySub.set(tx.subcategoryId, (spentBySub.get(tx.subcategoryId) ?? 0) - tx.amount);
      }
    }
  }

  // Attribute transfer fees to Expense > Lainnya > Biaya if it exists
  if (type === 'expense' && transferFeeExpense > 0) {
    const biayaSub = subcategories.find((s) => s.id === 'sub_exp_biaya' || s.name.toLowerCase() === 'biaya');
    if (biayaSub) {
      spentBySub.set(biayaSub.id, (spentBySub.get(biayaSub.id) ?? 0) + transferFeeExpense);
    }
  }

  const filteredCats = categories
    .filter((c) => c.type === type && !c.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  let totalEffectiveBudget = 0;
  let totalActual = 0;

  const items: CategoryBudgetStatus[] = filteredCats.map((category) => {
    const subs = subcategories
      .filter((s) => s.categoryId === category.id && !s.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const subBudgetSum = subs.reduce((sum, s) => sum + (s.monthlyBudget ?? 0), 0);
    // Interpretasi B: if category cap is set, effective budget = cap; else sum of sub budgets
    const effectiveBudget =
      category.budgetCap !== null
        ? category.budgetCap
        : subBudgetSum > 0
          ? subBudgetSum
          : null;

    const hasSubOverflow = category.budgetCap !== null && subBudgetSum > category.budgetCap;

    const subStatuses = subs.map((s) => {
      const actual = spentBySub.get(s.id) ?? 0;
      const pct = s.monthlyBudget && s.monthlyBudget > 0 ? Math.round((actual / s.monthlyBudget) * 100) : null;
      return { subcategory: s, actual, pct };
    });

    const actual = subStatuses.reduce((sum, s) => sum + s.actual, 0);
    const pct =
      effectiveBudget !== null && effectiveBudget > 0
        ? Math.round((actual / effectiveBudget) * 100)
        : null;

    let status: CategoryBudgetStatus['status'] = 'track';
    if (pct !== null) {
      if (pct >= 100) status = 'over';
      else if (pct >= 80) status = 'warn';
      else status = 'safe';
    }

    if (effectiveBudget !== null) totalEffectiveBudget += effectiveBudget;
    totalActual += actual;

    return {
      category,
      effectiveBudget,
      subBudgetSum,
      hasSubOverflow,
      actual,
      pct,
      status,
      subStatuses,
    };
  });

  return { items, totalEffectiveBudget, totalActual };
}

export function calculateZeroBasedAllocation(
  categories: Category[],
  subcategories: Subcategory[]
) {
  const incomeTarget = subcategories
    .filter((s) => !s.archived)
    .filter((s) => {
      const cat = categories.find((c) => c.id === s.categoryId);
      return cat && cat.type === 'income' && !cat.archived;
    })
    .reduce((sum, s) => sum + (s.monthlyBudget ?? 0), 0);

  const expenseBudget = calculateCategoryBudgets(categories, subcategories, [], 'expense').totalEffectiveBudget;
  const savingBudget = calculateCategoryBudgets(categories, subcategories, [], 'saving').totalEffectiveBudget;

  return {
    incomeTarget,
    expenseBudget,
    savingBudget,
    unallocated: incomeTarget - expenseBudget - savingBudget,
  };
}

// ==================== GOALS PROGRESS ====================

export function calculateGoalProgress(
  goal: Goal,
  transactions: Transaction[],
  referenceDate = new Date()
) {
  let saved = 0;
  for (const tx of transactions) {
    if (tx.goalId !== goal.id) continue;
    if (tx.type === 'saving') saved += tx.amount;
    else if (tx.type === 'saving_withdrawal') saved -= tx.amount;
  }
  saved = Math.max(0, saved);

  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((saved / goal.targetAmount) * 100)) : 0;
  const remaining = Math.max(0, goal.targetAmount - saved);

  let monthsLeft: number | null = null;
  let requiredPerMonth: number | null = null;
  if (goal.deadline) {
    const dl = new Date(`${goal.deadline}T00:00:00`);
    const diffDays = Math.ceil((dl.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    monthsLeft = Math.max(1, Math.ceil(diffDays / 30));
    requiredPerMonth = remaining > 0 ? Math.ceil(remaining / monthsLeft) : 0;
  }

  return { saved, pct, remaining, monthsLeft, requiredPerMonth };
}

// ==================== MONTHLY SERIES & WALLET HISTORY ====================

export function buildMonthlyTrend(
  transactions: Transaction[],
  monthsCount = 6,
  referenceDate = new Date()
) {
  const result: { key: string; label: string; income: number; expense: number; saving: number }[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = MONTHS_SHORT[d.getMonth()];
    const monthTx = transactions.filter((t) => t.date.startsWith(key));
    const sum = calculatePeriodSummary(monthTx);
    result.push({
      key,
      label,
      income: sum.income,
      expense: sum.expense,
      saving: Math.max(0, sum.savingNet),
    });
  }
  return result;
}

export function buildWalletHistory30Days(
  wallet: Wallet,
  transactions: Transaction[],
  referenceDate = new Date()
): { date: string; label: string; balance: number }[] {
  const days: { date: string; label: string; balance: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    const iso = toISODate(d);
    const upToDay = transactions.filter((t) => t.date <= iso);
    const bal = calculateWalletBalances([wallet], upToDay)[0]?.balance ?? wallet.openingBalance;
    days.push({
      date: iso,
      label: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`,
      balance: bal,
    });
  }
  return days;
}

// ==================== CSV EXPORT ====================

export function transactionsToCSV(
  transactions: Transaction[],
  wallets: Wallet[],
  categories: Category[],
  subcategories: Subcategory[]
): string {
  const wMap = new Map(wallets.map((w) => [w.id, w.name]));
  const cMap = new Map(categories.map((c) => [c.id, c.name]));
  const sMap = new Map(subcategories.map((s) => [s.id, s]));

  const esc = (v: string | number) => {
    const str = String(v ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const header = ['Tanggal', 'Tipe', 'Kategori', 'Sub-Kategori', 'Wallet', 'Ke Wallet', 'Nominal', 'Biaya Admin', 'Catatan'];
  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) => {
      const sub = tx.subcategoryId ? sMap.get(tx.subcategoryId) : undefined;
      const catName = sub ? cMap.get(sub.categoryId) ?? '' : '';
      return [
        tx.date,
        tx.type,
        catName,
        sub?.name ?? '',
        wMap.get(tx.walletId) ?? '',
        tx.toWalletId ? wMap.get(tx.toWalletId) ?? '' : '',
        tx.amount,
        tx.fee,
        tx.note,
      ]
        .map(esc)
        .join(',');
    });

  return [header.join(','), ...rows].join('\n');
}
