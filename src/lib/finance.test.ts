import { describe, expect, it } from 'vitest';
import { answerFinancialQuestion, generateFinancialInsights } from '@/lib/advisor';
import { applyThreeMonthDummyData, clearDummyData } from '@/lib/dummyData';
import {
  buildDailyExpenseHeatmap,
  buildPeriodOptions,
  calculateCategoryBudgets,
  calculateGoalProgress,
  calculateMoMComparison,
  calculateNetWorth,
  calculatePeriodSummary,
  calculateWalletBalances,
  calculateZeroBasedAllocation,
  formatIDR,
  getPeriodRange,
  parseAmountExpression,
} from '@/lib/finance';
import {
  createInitialDataset,
  createSeedCategories,
  createSeedGoals,
  createSeedWallets,
} from '@/lib/seed';
import { normalizeSupabaseKey, normalizeSupabaseUrl } from '@/lib/supabase/client';
import type { Transaction, WalletValuation } from '@/types/finance';

describe('parseAmountExpression', () => {
  it('parses plain numbers and Indonesian shorthand', () => {
    expect(parseAmountExpression('25000').value).toBe(25000);
    expect(parseAmountExpression('25rb').value).toBe(25000);
    expect(parseAmountExpression('25k').value).toBe(25000);
    expect(parseAmountExpression('1,5jt').value).toBe(1500000);
    expect(parseAmountExpression('1.5jt').value).toBe(1500000);
  });

  it('evaluates split-bill addition and subtraction expressions', () => {
    expect(parseAmountExpression('45k+12k').value).toBe(57000);
    expect(parseAmountExpression('45000+12000').value).toBe(57000);
    expect(parseAmountExpression('100rb-15rb').value).toBe(85000);
    expect(parseAmountExpression('45k+12k').isExpression).toBe(true);
  });

  it('handles empty or negative-clamped values safely', () => {
    expect(parseAmountExpression('').value).toBe(0);
    expect(parseAmountExpression('10rb-50rb').value).toBe(0);
  });
});

describe('calculateWalletBalances & Net Worth (Blueprint §2)', () => {
  const wallets = createSeedWallets('2026-11-01').map((w) => {
    if (w.id === 'w_jago') return { ...w, openingBalance: 3000000 };
    if (w.id === 'w_gopay') return { ...w, openingBalance: 200000 };
    if (w.id === 'w_bibit') return { ...w, openingBalance: 10000000 };
    return w;
  });

  const txs: Transaction[] = [
    // Income: +3.6jt to Jago
    {
      id: 't1',
      date: '2026-11-01',
      type: 'income',
      subcategoryId: 'sub_inc_gaji',
      walletId: 'w_jago',
      toWalletId: null,
      amount: 3600000,
      fee: 0,
      goalId: null,
      note: 'Gaji Nov',
      createdAt: '2026-11-01T09:00:00Z',
    },
    // Transfer: 500k Jago -> GoPay with Rp2.500 admin fee
    {
      id: 't2',
      date: '2026-11-02',
      type: 'transfer',
      subcategoryId: null,
      walletId: 'w_jago',
      toWalletId: 'w_gopay',
      amount: 500000,
      fee: 2500,
      goalId: null,
      note: 'Top up GoPay',
      createdAt: '2026-11-02T09:00:00Z',
    },
    // Expense: 50k from GoPay
    {
      id: 't3',
      date: '2026-11-03',
      type: 'expense',
      subcategoryId: 'sub_exp_kafe',
      walletId: 'w_gopay',
      toWalletId: null,
      amount: 50000,
      fee: 0,
      goalId: null,
      note: 'Kopi',
      createdAt: '2026-11-03T09:00:00Z',
    },
    // Saving: 600k Jago -> Bibit (linked to Wedding)
    {
      id: 't4',
      date: '2026-11-05',
      type: 'saving',
      subcategoryId: 'sub_sav_wedding',
      walletId: 'w_jago',
      toWalletId: 'w_bibit',
      amount: 600000,
      fee: 0,
      goalId: 'goal_wedding',
      note: 'Wedding',
      createdAt: '2026-11-05T09:00:00Z',
    },
    // Adjustment: +10k to GoPay
    {
      id: 't5',
      date: '2026-11-06',
      type: 'adjustment',
      subcategoryId: null,
      walletId: 'w_gopay',
      toWalletId: null,
      amount: 10000,
      fee: 0,
      goalId: null,
      note: 'Rekonsiliasi',
      createdAt: '2026-11-06T09:00:00Z',
    },
  ];

  it('computes live balances accurately across income, expense, transfer+fee, saving, and adjustment', () => {
    const balances = calculateWalletBalances(wallets, txs);
    const byId = new Map(balances.map((b) => [b.wallet.id, b]));

    // Jago: 3,000,000 + 3,600,000 - 500,000 - 2,500 - 600,000 = 5,497,500
    expect(byId.get('w_jago')?.balance).toBe(5497500);
    // GoPay: 200,000 + 500,000 - 50,000 + 10,000 = 660,000
    expect(byId.get('w_gopay')?.balance).toBe(660000);
    // Bibit: 10,000,000 + 600,000 = 10,600,000
    expect(byId.get('w_bibit')?.balance).toBe(10600000);
  });

  it('excludes transfer principal & saving from Expense, counts transfer fee as Expense, computes Savings Rate', () => {
    const summary = calculatePeriodSummary(txs);
    expect(summary.income).toBe(3600000);
    // Expense = 50,000 (Kafe) + 2,500 (transfer fee). Transfer 500k and Saving 600k are NOT expense!
    expect(summary.expense).toBe(52500);
    expect(summary.savingNet).toBe(600000);
    expect(summary.transferVolume).toBe(500000);
    expect(summary.adjustmentNet).toBe(10000);
    // Savings rate = 600,000 / 3,600,000 = 16.7%
    expect(summary.savingsRate).toBe(16.7);
  });

  it('applies investment market valuation snapshots + subsequent contributions cleanly', () => {
    const valuations: WalletValuation[] = [
      { id: 'v1', walletId: 'w_bibit', date: '2026-11-04', marketValue: 10500000 },
    ];
    const balances = calculateWalletBalances(wallets, txs, valuations);
    const bibit = balances.find((b) => b.wallet.id === 'w_bibit')!;
    // Cost basis = 10,600,000. Valuation on Nov 4 = 10,500,000 + Nov 5 deposit 600,000 = 11,100,000
    expect(bibit.costBasis).toBe(10600000);
    expect(bibit.balance).toBe(11100000);
    expect(bibit.unrealizedGain).toBe(500000);

    const nw = calculateNetWorth(balances);
    expect(nw.investment).toBe(11100000);
    expect(nw.liquid).toBe(5497500 + 660000);
    expect(nw.netWorth).toBe(11100000 + 5497500 + 660000);
  });
});

describe('Budget Interpretasi B & Zero-Based Seed Audit', () => {
  it('matches finalized seed numbers (Income 6jt, Expense 3.425jt, Saving 1.1jt, Surplus +1.475jt)', () => {
    const { categories, subcategories } = createSeedCategories();
    const alloc = calculateZeroBasedAllocation(categories, subcategories);

    expect(alloc.incomeTarget).toBe(6000000);
    expect(alloc.expenseBudget).toBe(3425000);
    expect(alloc.savingBudget).toBe(1100000);
    expect(alloc.unallocated).toBe(1475000);
  });

  it('flags sub-category budget sum exceeding parent cap', () => {
    const { categories, subcategories } = createSeedCategories();
    // Belanja cap is 500k; raise Belanja bulanan to 600k
    const modifiedSubs = subcategories.map((s) =>
      s.id === 'sub_exp_belanja_bulanan' ? { ...s, monthlyBudget: 600000 } : s
    );
    const result = calculateCategoryBudgets(categories, modifiedSubs, [], 'expense');
    const belanja = result.items.find((i) => i.category.id === 'cat_exp_belanja')!;
    expect(belanja.effectiveBudget).toBe(500000);
    expect(belanja.hasSubOverflow).toBe(true);
  });
});

describe('Goal Progress & IDR Formatting', () => {
  it('tracks saving & withdrawal against goals', () => {
    const goals = createSeedGoals();
    const wedding = goals[0];
    const txs: Transaction[] = [
      {
        id: 'g1',
        date: '2026-11-01',
        type: 'saving',
        subcategoryId: 'sub_sav_wedding',
        walletId: 'w_jago',
        toWalletId: 'w_bibit',
        amount: 2000000,
        fee: 0,
        goalId: 'goal_wedding',
        note: '',
        createdAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'g2',
        date: '2026-11-10',
        type: 'saving_withdrawal',
        subcategoryId: 'sub_sav_wedding',
        walletId: 'w_bibit',
        toWalletId: 'w_jago',
        amount: 500000,
        fee: 0,
        goalId: 'goal_wedding',
        note: '',
        createdAt: '2026-11-10T00:00:00Z',
      },
    ];
    const prog = calculateGoalProgress(wedding, txs, new Date('2026-11-21T00:00:00Z'));
    expect(prog.saved).toBe(1500000);
    expect(prog.pct).toBe(3);
  });

  it('formats IDR with dot separators and masks in privacy mode', () => {
    expect(formatIDR(3600000)).toBe('Rp3.600.000');
    expect(formatIDR(-925000)).toBe('-Rp925.000');
    expect(formatIDR(3600000, true)).toBe('Rp•••••');
  });
});

describe('6-Month Rolling Period Selector & Income Budgets', () => {
  it('only includes past months (up to 6 months back) that have transactions', () => {
    const ref = new Date(2026, 10, 21); // Nov 21, 2026

    // Empty transactions -> only current month and all time
    const emptyOpts = buildPeriodOptions([], ref);
    expect(emptyOpts.map((o) => o.value)).toEqual(['this_month', 'all']);

    // Transactions in Oct 2026, Jul 2026, May 2026, and Jan 2026 (>6 months back)
    const sampleTxs: Transaction[] = ['2026-10-12', '2026-07-04', '2026-05-19', '2026-01-10'].map(
      (date, i) => ({
        id: `p${i}`,
        date,
        type: 'expense',
        subcategoryId: 'sub_exp_kafe',
        walletId: 'w_gopay',
        toWalletId: null,
        amount: 25000,
        fee: 0,
        goalId: null,
        note: '',
        createdAt: `${date}T09:00:00Z`,
      })
    );

    const opts = buildPeriodOptions(sampleTxs, ref);
    expect(opts.map((o) => o.value)).toEqual([
      'this_month',
      'last_month',
      'month:2026-07',
      'month:2026-05',
      'this_year',
      'all',
    ]);

    const range = getPeriodRange('month:2026-05', ref);
    expect(range.start).toBe('2026-05-01');
    expect(range.end).toBe('2026-05-31');
    expect(range.label).toBe('Mei 2026');
  });

  it('calculates income budget progress positively when target is reached', () => {
    const { categories, subcategories } = createSeedCategories();
    const txs: Transaction[] = [
      {
        id: 'inc1',
        date: '2026-11-01',
        type: 'income',
        subcategoryId: 'sub_inc_gaji',
        walletId: 'w_jago',
        toWalletId: null,
        amount: 6000000,
        fee: 0,
        goalId: null,
        note: 'Gaji',
        createdAt: '2026-11-01T09:00:00Z',
      },
    ];
    const res = calculateCategoryBudgets(categories, subcategories, txs, 'income');
    const pemasukan = res.items.find((i) => i.category.id === 'cat_inc_pemasukan')!;
    expect(pemasukan.effectiveBudget).toBe(6000000);
    expect(pemasukan.actual).toBe(6000000);
    expect(pemasukan.pct).toBe(100);
    expect(pemasukan.status).toBe('safe');
  });
});

describe('Phase 2 & 3: Bibit Multi-Product, Shared Wedding Goal, Dummy Data, Analytics & AI Advisor', () => {
  it('generates 3-month dummy data with 5 Bibit products and cleanly removes it back to 0', () => {
    const ref = new Date(2026, 10, 21); // Nov 21, 2026
    const fresh = createInitialDataset('Iza', '2026-11-21');
    const demo = applyThreeMonthDummyData(fresh, ref);

    expect(demo.profile.isDemoData).toBe(true);
    expect(demo.transactions.length).toBeGreaterThan(50);
    expect(demo.investmentProducts.map((p) => p.assetClass)).toEqual([
      'pu',
      'obligasi',
      'reksa_saham',
      'saham',
      'sbn',
    ]);
    expect(demo.goalContributions.length).toBe(3);
    expect(demo.recurringRules.length).toBe(5);

    // Bibit balance aggregates all 5 products: Modal 14.000.000, Market 14.533.000 (+533.000)
    const bals = calculateWalletBalances(
      demo.wallets,
      demo.transactions,
      demo.valuations,
      demo.investmentProducts
    );
    const bibit = bals.find((b) => b.wallet.id === 'w_bibit')!;
    expect(bibit.costBasis).toBe(14000000);
    expect(bibit.balance).toBe(14533000);
    expect(bibit.unrealizedGain).toBe(533000);

    // Clear dummy data back to 0 cleanly
    const cleaned = clearDummyData(demo, ref);
    expect(cleaned.profile.isDemoData).toBe(false);
    expect(cleaned.transactions.length).toBe(0);
    expect(cleaned.goalContributions.length).toBe(0);
    expect(cleaned.recurringRules.length).toBe(0);
    expect(cleaned.investmentProducts.every((p) => p.investedAmount === 0 && p.marketValue === 0)).toBe(true);
  });

  it('computes Shared Wedding Goal progress combining Bibit products + partner contributions without double-counting', () => {
    const ref = new Date(2026, 10, 21);
    const demo = applyThreeMonthDummyData(createInitialDataset('Iza', '2026-11-21'), ref);
    const wedding = demo.goals.find((g) => g.id === 'goal_wedding')!;

    const prog = calculateGoalProgress(
      wedding,
      demo.transactions,
      ref,
      demo.goalContributions,
      demo.investmentProducts
    );
    // All 5 Bibit Wedding products sum to 14.533.000 (product-linked saving txs NOT double-counted)
    expect(prog.mySaved).toBe(14533000);
    // Partner contributions: 4.5jt + 1.25jt + 1.5jt = 7.250.000
    expect(prog.partnerSaved).toBe(7250000);
    expect(prog.saved).toBe(21783000);
    expect(prog.linkedProducts.length).toBe(5);
  });

  it('computes MoM comparison, 84-day expense heatmap, and AI Advisor insights', () => {
    const ref = new Date(2026, 10, 21);
    const demo = applyThreeMonthDummyData(createInitialDataset('Iza', '2026-11-21'), ref);

    const mom = calculateMoMComparison(demo.transactions, demo.categories, demo.subcategories, ref);
    expect(mom.income.current).toBeGreaterThan(0);
    expect(mom.expense.previous).toBeGreaterThan(0);
    expect(mom.categoryChanges.length).toBeGreaterThan(0);

    const heat = buildDailyExpenseHeatmap(demo.transactions, 84, ref);
    expect(heat.length).toBe(84);
    expect(heat.some((d) => d.level >= 3)).toBe(true);

    const report = generateFinancialInsights(demo, ref);
    expect(report.score).toBeGreaterThan(40);
    expect(report.cards.some((c) => c.topic === 'bibit')).toBe(true);
    expect(report.cards.some((c) => c.topic === 'wedding')).toBe(true);

    const bibitAns = answerFinancialQuestion('Evaluasi portofolio Bibit PU Obligasi SBN', demo, ref);
    expect(bibitAns.topic).toBe('bibit');
    expect(bibitAns.answer).toContain('Pasar Uang');
    expect(bibitAns.answer).toContain('SBN');
  });

  it('normalizes Supabase URLs copied from Data API (/rest/v1) and trims API keys', () => {
    expect(normalizeSupabaseUrl('https://abcdef123456.supabase.co/rest/v1')).toBe(
      'https://abcdef123456.supabase.co'
    );
    expect(normalizeSupabaseUrl('  https://abcdef123456.supabase.co/auth/v1/callback  ')).toBe(
      'https://abcdef123456.supabase.co'
    );
    expect(normalizeSupabaseUrl('abcdef123456.supabase.co/rest/v1/')).toBe(
      'https://abcdef123456.supabase.co'
    );
    expect(normalizeSupabaseUrl('')).toBeNull();
    expect(normalizeSupabaseKey('  sb_publishable_xyz  ')).toBe('sb_publishable_xyz');
  });
});


