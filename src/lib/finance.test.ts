import { describe, expect, it } from 'vitest';
import {
  calculateCategoryBudgets,
  calculateGoalProgress,
  calculateNetWorth,
  calculatePeriodSummary,
  calculateWalletBalances,
  calculateZeroBasedAllocation,
  formatIDR,
  parseAmountExpression,
} from '@/lib/finance';
import { createSeedCategories, createSeedGoals, createSeedWallets } from '@/lib/seed';
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
  it('matches Blueprint §3.1 exact seed numbers (Income 3.6jt, Expense 3.425jt, Saving 1.1jt, Deficit -925rb)', () => {
    const { categories, subcategories } = createSeedCategories();
    const alloc = calculateZeroBasedAllocation(categories, subcategories);

    expect(alloc.incomeTarget).toBe(3600000);
    expect(alloc.expenseBudget).toBe(3425000);
    expect(alloc.savingBudget).toBe(1100000);
    expect(alloc.unallocated).toBe(-925000);
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
