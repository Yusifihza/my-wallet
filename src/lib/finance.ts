import type {
  AppDataset,
  Category,
  CategoryBudgetStatus,
  Goal,
  GoalContribution,
  InvestmentProduct,
  PeriodPreset,
  PeriodSummary,
  RecurringRule,
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
  valuations: WalletValuation[] = [],
  investmentProducts: InvestmentProduct[] = []
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
    const txCostBasis = wallet.openingBalance + (deltaMap.get(wallet.id) ?? 0);

    // Check multi-product investment holdings (e.g. Bibit: PU, Obligasi, Reksa Saham, Saham, SBN)
    if (wallet.group === 'investment') {
      const products = investmentProducts.filter((p) => p.walletId === wallet.id);
      const hasActiveProducts = products.some((p) => p.investedAmount > 0 || p.marketValue > 0);
      if (hasActiveProducts) {
        const prodInvested = products.reduce((s, p) => s + Math.max(0, p.investedAmount), 0);
        const prodMarket = products.reduce((s, p) => s + Math.max(0, p.marketValue), 0);
        const latestDate = products.reduce<string | null>(
          (max, p) => (!max || p.updatedAt > max ? p.updatedAt : max),
          null
        );
        const unrealizedGain = prodMarket - prodInvested;
        const unrealizedGainPct = prodInvested > 0 ? (unrealizedGain / prodInvested) * 100 : null;
        return {
          wallet,
          costBasis: prodInvested,
          balance: prodMarket,
          unrealizedGain,
          unrealizedGainPct,
          lastValuationDate: latestDate,
        };
      }
    }

    // Fallback: single-wallet valuation snapshot
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
      const unrealizedGain = balance - txCostBasis;
      const unrealizedGainPct = txCostBasis > 0 ? (unrealizedGain / txCostBasis) * 100 : null;
      return {
        wallet,
        costBasis: txCostBasis,
        balance,
        unrealizedGain,
        unrealizedGainPct,
        lastValuationDate: latest.date,
      };
    }

    return {
      wallet,
      costBasis: txCostBasis,
      balance: txCostBasis,
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

export interface PeriodOption {
  value: PeriodPreset;
  label: string;
}

/**
 * Generates period dropdown options dynamically from available transaction data:
 * - Always includes current month ("Bulan ini")
 * - Includes past months (1..6 months back) ONLY when at least one transaction exists in that month
 * - Includes "3 Bulan Terakhir" and "Tahun YYYY" when transactions span multiple months
 * - Always includes "Semua Waktu"
 */
export function buildPeriodOptions(
  transactions: Transaction[] = [],
  referenceDate = new Date()
): PeriodOption[] {
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();
  const currentYm = `${y}-${String(m + 1).padStart(2, '0')}`;

  const txMonths = new Set<string>();
  for (const tx of transactions) {
    if (tx.date && tx.date.length >= 7) {
      txMonths.add(tx.date.slice(0, 7));
    }
  }

  const options: PeriodOption[] = [
    { value: 'this_month', label: `Bulan ini (${MONTHS_SHORT[m]} ${y})` },
  ];

  let pastMonthsWithin6 = 0;
  let monthsWithin3 = txMonths.has(currentYm) ? 1 : 0;

  for (let offset = 1; offset <= 6; offset++) {
    const d = new Date(y, m - offset, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const ym = `${yr}-${String(mo + 1).padStart(2, '0')}`;
    if (!txMonths.has(ym)) continue;

    pastMonthsWithin6++;
    if (offset <= 2) monthsWithin3++;

    if (offset === 1) {
      options.push({
        value: 'last_month',
        label: `Bulan lalu (${MONTHS_SHORT[mo]} ${yr})`,
      });
    } else {
      options.push({
        value: `month:${ym}`,
        label: `${MONTHS_LONG[mo]} ${yr}`,
      });
    }
  }

  if (monthsWithin3 >= 2) {
    options.push({ value: 'last_3_months', label: '3 Bulan Terakhir' });
  }

  const monthsInCurrentYear = [...txMonths].filter((ym) => ym.startsWith(`${y}-`)).length;
  if (monthsInCurrentYear >= 2 || pastMonthsWithin6 >= 2) {
    options.push({ value: 'this_year', label: `Tahun ${y}` });
  }

  options.push({ value: 'all', label: 'Semua Waktu' });

  return options;
}

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
  if (preset.startsWith('month:')) {
    const [yrStr, moStr] = preset.slice(6).split('-');
    const yr = Number(yrStr);
    const mo = Number(moStr) - 1;
    if (!Number.isNaN(yr) && !Number.isNaN(mo) && mo >= 0 && mo <= 11) {
      const start = toISODate(new Date(yr, mo, 1));
      const end = toISODate(new Date(yr, mo + 1, 0));
      return { start, end, label: formatMonthYearID(yr, mo) };
    }
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
  type: 'income' | 'expense' | 'saving' = 'expense'
): {
  items: CategoryBudgetStatus[];
  totalEffectiveBudget: number;
  totalActual: number;
} {
  const spentBySub = new Map<string, number>();
  let transferFeeExpense = 0;

  for (const tx of transactions) {
    if (type === 'income') {
      if (tx.type === 'income' && tx.subcategoryId) {
        spentBySub.set(tx.subcategoryId, (spentBySub.get(tx.subcategoryId) ?? 0) + tx.amount);
      }
    } else if (type === 'expense') {
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
      if (type === 'expense') {
        if (pct >= 100) status = 'over';
        else if (pct >= 80) status = 'warn';
        else status = 'safe';
      } else {
        // For income & saving, higher progress is positive
        status = 'safe';
      }
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
  const incomeTarget = calculateCategoryBudgets(categories, subcategories, [], 'income').totalEffectiveBudget;
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
  referenceDate = new Date(),
  contributions: GoalContribution[] = [],
  investmentProducts: InvestmentProduct[] = []
) {
  const linkedProducts = investmentProducts.filter((p) => p.goalId === goal.id);
  const linkedProductIds = new Set(linkedProducts.map((p) => p.id));
  const productMarketTotal = linkedProducts.reduce((s, p) => s + Math.max(0, p.marketValue), 0);
  const productInvestedTotal = linkedProducts.reduce((s, p) => s + Math.max(0, p.investedAmount), 0);
  const hasActiveProducts = productMarketTotal > 0 || productInvestedTotal > 0;

  let txSaved = 0;
  for (const tx of transactions) {
    if (tx.goalId !== goal.id) continue;
    // Avoid double-counting deposits already tracked in linked investment product values
    if (hasActiveProducts && tx.investmentProductId && linkedProductIds.has(tx.investmentProductId)) {
      continue;
    }
    if (tx.type === 'saving') txSaved += tx.amount;
    else if (tx.type === 'saving_withdrawal') txSaved -= tx.amount;
  }

  const mySaved = Math.max(0, txSaved + productMarketTotal);
  const partnerSaved = Math.max(
    0,
    contributions
      .filter((c) => c.goalId === goal.id && c.isPartner)
      .reduce((s, c) => s + c.amount, 0)
  );
  const saved = mySaved + partnerSaved;

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

  return {
    saved,
    mySaved,
    partnerSaved,
    myInvested: productInvestedTotal,
    myMarketGain: productMarketTotal - productInvestedTotal,
    linkedProducts,
    pct,
    remaining,
    monthsLeft,
    requiredPerMonth,
  };
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

// ==================== PHASE 2 ANALYTICS: MoM, YoY, HEATMAP, BIBIT CHART ====================

export interface MoMDelta {
  current: number;
  previous: number;
  diff: number;
  pct: number | null;
}

export interface CategoryMoMChange {
  categoryId: string;
  categoryName: string;
  color: string;
  current: number;
  previous: number;
  diff: number;
  pct: number | null;
}

export function calculateMoMComparison(
  transactions: Transaction[],
  categories: Category[],
  subcategories: Subcategory[],
  referenceDate = new Date()
) {
  const curRange = getPeriodRange('this_month', referenceDate);
  const prevRange = getPeriodRange('last_month', referenceDate);
  const curTx = filterTransactionsByRange(transactions, curRange.start, curRange.end);
  const prevTx = filterTransactionsByRange(transactions, prevRange.start, prevRange.end);
  const curSum = calculatePeriodSummary(curTx);
  const prevSum = calculatePeriodSummary(prevTx);

  const delta = (c: number, p: number): MoMDelta => ({
    current: c,
    previous: p,
    diff: c - p,
    pct: p > 0 ? Math.round(((c - p) / p) * 1000) / 10 : null,
  });

  const curBud = calculateCategoryBudgets(categories, subcategories, curTx, 'expense').items;
  const prevBud = calculateCategoryBudgets(categories, subcategories, prevTx, 'expense').items;
  const prevMap = new Map(prevBud.map((x) => [x.category.id, x.actual]));

  const categoryChanges: CategoryMoMChange[] = curBud
    .map((x) => {
      const prev = prevMap.get(x.category.id) ?? 0;
      const diff = x.actual - prev;
      return {
        categoryId: x.category.id,
        categoryName: x.category.name,
        color: x.category.color,
        current: x.actual,
        previous: prev,
        diff,
        pct: prev > 0 ? Math.round((diff / prev) * 1000) / 10 : null,
      };
    })
    .filter((c) => c.current > 0 || c.previous > 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    currentLabel: curRange.label,
    previousLabel: prevRange.label,
    income: delta(curSum.income, prevSum.income),
    expense: delta(curSum.expense, prevSum.expense),
    saving: delta(Math.max(0, curSum.savingNet), Math.max(0, prevSum.savingNet)),
    netCashflow: delta(curSum.netCashflow, prevSum.netCashflow),
    categoryChanges,
  };
}

export function calculateYoYComparison(
  transactions: Transaction[],
  referenceDate = new Date()
) {
  const y = referenceDate.getFullYear();
  const curYearTx = filterTransactionsByRange(transactions, `${y}-01-01`, `${y}-12-31`);
  const prevYearTx = filterTransactionsByRange(transactions, `${y - 1}-01-01`, `${y - 1}-12-31`);
  const curSum = calculatePeriodSummary(curYearTx);
  const prevSum = calculatePeriodSummary(prevYearTx);

  const delta = (c: number, p: number): MoMDelta => ({
    current: c,
    previous: p,
    diff: c - p,
    pct: p > 0 ? Math.round(((c - p) / p) * 1000) / 10 : null,
  });

  return {
    currentYear: y,
    previousYear: y - 1,
    hasPreviousYearData: prevYearTx.length > 0,
    income: delta(curSum.income, prevSum.income),
    expense: delta(curSum.expense, prevSum.expense),
    saving: delta(Math.max(0, curSum.savingNet), Math.max(0, prevSum.savingNet)),
  };
}

export interface HeatmapDay {
  date: string;
  dayOfWeek: number; // 0=Mon .. 6=Sun
  amount: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export function buildDailyExpenseHeatmap(
  transactions: Transaction[],
  daysCount = 84,
  referenceDate = new Date()
): HeatmapDay[] {
  const dailyMap = new Map<string, { amount: number; count: number }>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' && !(tx.type === 'transfer' && tx.fee > 0)) continue;
    const amt = tx.type === 'expense' ? tx.amount : tx.fee;
    const prev = dailyMap.get(tx.date) ?? { amount: 0, count: 0 };
    dailyMap.set(tx.date, { amount: prev.amount + amt, count: prev.count + 1 });
  }

  const raw: { date: string; dayOfWeek: number; amount: number; count: number }[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    const iso = toISODate(d);
    const entry = dailyMap.get(iso) ?? { amount: 0, count: 0 };
    raw.push({
      date: iso,
      dayOfWeek: (d.getDay() + 6) % 7,
      amount: entry.amount,
      count: entry.count,
    });
  }

  const nonZero = raw.map((r) => r.amount).filter((a) => a > 0).sort((a, b) => a - b);
  const q1 = nonZero[Math.floor(nonZero.length * 0.25)] ?? 50000;
  const q2 = nonZero[Math.floor(nonZero.length * 0.5)] ?? 150000;
  const q3 = nonZero[Math.floor(nonZero.length * 0.75)] ?? 350000;

  return raw.map((r) => {
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (r.amount > 0) {
      if (r.amount <= q1) level = 1;
      else if (r.amount <= q2) level = 2;
      else if (r.amount <= q3) level = 3;
      else level = 4;
    }
    return { ...r, level };
  });
}

export interface BibitHistoryPoint {
  date: string;
  label: string;
  invested: number;
  marketValue: number;
  gain: number;
}

export function buildBibitHistorySeries(
  wallet: Wallet,
  valuations: WalletValuation[],
  transactions: Transaction[],
  products: InvestmentProduct[],
  referenceDate = new Date()
): BibitHistoryPoint[] {
  const walletVals = valuations
    .filter((v) => v.walletId === wallet.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const prodList = products.filter((p) => p.walletId === wallet.id);
  const currentInvested = prodList.reduce((s, p) => s + p.investedAmount, 0);
  const currentMarket = prodList.reduce((s, p) => s + p.marketValue, 0);

  if (walletVals.length === 0) {
    if (currentInvested === 0 && currentMarket === 0) return [];
    const iso = toISODate(referenceDate);
    return [
      {
        date: iso,
        label: formatDateID(iso),
        invested: currentInvested,
        marketValue: currentMarket,
        gain: currentMarket - currentInvested,
      },
    ];
  }

  // Reconstruct invested trajectory backwards from currentInvested using Bibit saving/withdrawal txs
  const bibitFlows = transactions.filter(
    (t) =>
      (t.type === 'saving' && t.toWalletId === wallet.id) ||
      (t.type === 'saving_withdrawal' && t.walletId === wallet.id) ||
      (t.type === 'transfer' && (t.toWalletId === wallet.id || t.walletId === wallet.id))
  );

  const flowAfter = (dateIso: string) => {
    let net = 0;
    for (const t of bibitFlows) {
      if (t.date <= dateIso) continue;
      if (t.toWalletId === wallet.id) net += t.amount;
      if (t.walletId === wallet.id) net -= t.amount;
    }
    return net;
  };

  const baseCurrentInvested =
    currentInvested > 0
      ? currentInvested
      : calculateWalletBalances([wallet], transactions, [])[0]?.costBasis ?? wallet.openingBalance;

  const pts: BibitHistoryPoint[] = walletVals.map((v) => {
    const inv = Math.max(0, baseCurrentInvested - flowAfter(v.date));
    return {
      date: v.date,
      label: formatDateID(v.date),
      invested: inv,
      marketValue: v.marketValue,
      gain: v.marketValue - inv,
    };
  });

  // Append live today point if products market value differs from last snapshot
  const todayStr = toISODate(referenceDate);
  if (currentMarket > 0) {
    const last = pts[pts.length - 1];
    if (!last || last.date < todayStr) {
      pts.push({
        date: todayStr,
        label: 'Hari ini',
        invested: currentInvested,
        marketValue: currentMarket,
        gain: currentMarket - currentInvested,
      });
    } else if (last.date === todayStr) {
      last.invested = currentInvested;
      last.marketValue = currentMarket;
      last.gain = currentMarket - currentInvested;
    }
  }

  return pts;
}

export function advanceRecurringDate(
  dateIso: string,
  frequency: RecurringRule['frequency'],
  dayOfMonth = 1
): string {
  const d = new Date(`${dateIso}T00:00:00`);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else {
    const targetMonth = d.getMonth() + 1;
    const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
    const normMonth = targetMonth % 12;
    const maxDay = new Date(targetYear, normMonth + 1, 0).getDate();
    return toISODate(new Date(targetYear, normMonth, Math.min(Math.max(1, dayOfMonth), maxDay)));
  }
  return toISODate(d);
}

// ==================== GOOGLE SHEETS 5-TAB MIRROR PAYLOAD ====================

export function buildGoogleSheetsPayload(dataset: AppDataset, referenceDate = new Date()) {
  const wMap = new Map(dataset.wallets.map((w) => [w.id, w.name]));
  const cMap = new Map(dataset.categories.map((c) => [c.id, c.name]));
  const sMap = new Map(dataset.subcategories.map((s) => [s.id, s]));
  const pMap = new Map(dataset.investmentProducts.map((p) => [p.id, p.name]));

  const balances = calculateWalletBalances(
    dataset.wallets,
    dataset.transactions,
    dataset.valuations,
    dataset.investmentProducts
  );

  const txRows = [
    ['Tanggal', 'Tipe', 'Kategori', 'Sub-Kategori', 'Wallet', 'Ke Wallet', 'Produk Bibit', 'Nominal', 'Biaya Admin', 'Catatan'],
    ...[...dataset.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((tx) => {
        const sub = tx.subcategoryId ? sMap.get(tx.subcategoryId) : undefined;
        return [
          tx.date,
          tx.type,
          sub ? cMap.get(sub.categoryId) ?? '' : '',
          sub?.name ?? '',
          wMap.get(tx.walletId) ?? '',
          tx.toWalletId ? wMap.get(tx.toWalletId) ?? '' : '',
          tx.investmentProductId ? pMap.get(tx.investmentProductId) ?? '' : '',
          tx.amount,
          tx.fee,
          tx.note,
        ];
      }),
  ];

  const walletRows = [
    ['Dompet / Produk', 'Grup', 'Modal Disetor / Cost Basis', 'Saldo / Nilai Pasar', 'Untung/Rugi (Rp)', 'Return (%)'],
    ...balances
      .filter((b) => !b.wallet.hidden)
      .map((b) => [
        b.wallet.name,
        b.wallet.group,
        b.costBasis,
        b.balance,
        b.unrealizedGain,
        b.unrealizedGainPct !== null ? `${b.unrealizedGainPct.toFixed(2)}%` : '0%',
      ]),
    ...dataset.investmentProducts.map((p) => {
      const gain = p.marketValue - p.investedAmount;
      const pct = p.investedAmount > 0 ? ((gain / p.investedAmount) * 100).toFixed(2) : '0';
      return [`Bibit · ${p.name}`, `investasi:${p.assetClass}`, p.investedAmount, p.marketValue, gain, `${pct}%`];
    }),
  ];

  const curRange = getPeriodRange('this_month', referenceDate);
  const curTx = filterTransactionsByRange(dataset.transactions, curRange.start, curRange.end);
  const expBud = calculateCategoryBudgets(dataset.categories, dataset.subcategories, curTx, 'expense').items;
  const budgetRows = [
    ['Kategori', 'Plafon Efektif', 'Realisasi Bulan Ini', 'Persentase (%)', 'Status'],
    ...expBud.map((b) => [b.category.name, b.effectiveBudget ?? 0, b.actual, b.pct ?? 0, b.status]),
  ];

  const goalRows = [
    ['Goal', 'Bersama', 'Target', 'Kontribusi Aku', 'Kontribusi Pasangan', 'Total Terkumpul', 'Progres (%)', 'Deadline'],
    ...dataset.goals.map((g) => {
      const pr = calculateGoalProgress(g, dataset.transactions, referenceDate, dataset.goalContributions, dataset.investmentProducts);
      return [g.name, g.isShared ? 'Ya' : 'Tidak', g.targetAmount, pr.mySaved, pr.partnerSaved, pr.saved, `${pr.pct}%`, g.deadline ?? '-'];
    }),
  ];

  const trend = buildMonthlyTrend(dataset.transactions, 6, referenceDate);
  const summaryRows = [
    ['Bulan', 'Income', 'Expense', 'Saving Net', 'Net Cashflow'],
    ...trend.map((m) => [m.key, m.income, m.expense, m.saving, m.income - m.expense]),
  ];

  return {
    generatedAt: new Date().toISOString(),
    tabs: {
      Transaksi: txRows,
      Dompet_Bibit: walletRows,
      Budget: budgetRows,
      Goals_Pasangan: goalRows,
      Ringkasan_Bulanan: summaryRows,
    },
  };
}

