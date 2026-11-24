'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  PiggyBank,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import { generateFinancialInsights } from '@/lib/advisor';
import {
  buildMonthlyTrend,
  calculateCategoryBudgets,
  calculateGoalProgress,
  formatDateID,
  formatIDR,
  formatIDRCompact,
} from '@/lib/finance';
import { todayISO } from '@/lib/seed';

export function DashboardView() {
  const {
    dataset,
    nowDate,
    periodLabel,
    periodTransactions,
    periodSummary,
    visibleWalletBalances,
    netWorth,
    openQuickInput,
    openReceiptScanner,
    loadThreeMonthDummyData,
  } = useWallet();

  const privacy = dataset.profile.privacyMode;
  const today = todayISO();

  // Donut drill-down state: null = top-level categories, string = specific categoryId
  const [drillCatId, setDrillCatId] = useState<string | null>(null);

  const bibitSummary = useMemo(
    () => visibleWalletBalances.find((b) => b.wallet.group === 'investment') ?? null,
    [visibleWalletBalances]
  );

  const aiReport = useMemo(() => generateFinancialInsights(dataset, nowDate), [dataset, nowDate]);

  const monthlyTrend = useMemo(
    () => buildMonthlyTrend(dataset.transactions, 6, nowDate),
    [dataset.transactions, nowDate]
  );

  const expenseBudgets = useMemo(
    () =>
      calculateCategoryBudgets(
        dataset.categories,
        dataset.subcategories,
        periodTransactions,
        'expense'
      ),
    [dataset.categories, dataset.subcategories, periodTransactions]
  );

  const criticalBudgets = useMemo(() => {
    return [...expenseBudgets.items]
      .filter((i) => i.effectiveBudget !== null)
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
      .slice(0, 4);
  }, [expenseBudgets.items]);

  // Donut data (Category level OR drilled-down Sub-category level)
  const donutData = useMemo(() => {
    if (drillCatId) {
      const catItem = expenseBudgets.items.find((i) => i.category.id === drillCatId);
      if (!catItem) return [];
      const palette = ['#10b981', '#14b8a6', '#38bdf8', '#f59e0b', '#f97316', '#f43f5e', '#64748b'];
      return catItem.subStatuses
        .filter((s) => s.actual > 0)
        .sort((a, b) => b.actual - a.actual)
        .map((s, idx) => ({
          id: s.subcategory.id,
          name: s.subcategory.name,
          value: s.actual,
          color: palette[idx % palette.length],
        }));
    }

    return expenseBudgets.items
      .filter((i) => i.actual > 0)
      .sort((a, b) => b.actual - a.actual)
      .map((i) => ({
        id: i.category.id,
        name: i.category.name,
        value: i.actual,
        color: i.category.color,
      }));
  }, [drillCatId, expenseBudgets.items]);

  const drillCatName = drillCatId
    ? dataset.categories.find((c) => c.id === drillCatId)?.name ?? ''
    : '';

  const recentTx = useMemo(
    () =>
      [...dataset.transactions]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [dataset.transactions]
  );

  const subById = useMemo(
    () => new Map(dataset.subcategories.map((s) => [s.id, s])),
    [dataset.subcategories]
  );
  const catById = useMemo(
    () => new Map(dataset.categories.map((c) => [c.id, c])),
    [dataset.categories]
  );
  const walletById = useMemo(
    () => new Map(dataset.wallets.map((w) => [w.id, w])),
    [dataset.wallets]
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  })();

  return (
    <div className="space-y-5">
      {/* Greeting & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--mw-text-muted)]">
            {greeting}, {dataset.profile.displayName}
          </p>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
            Ringkasan {periodLabel}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openReceiptScanner}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--mw-surface)] hover:bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] inline-flex items-center gap-1.5 cursor-pointer transition"
          >
            <Camera className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
            <span>Scan Struk</span>
          </button>
          <button
            type="button"
            onClick={() => openQuickInput({ mode: 'create', type: 'transfer' })}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--mw-surface)] hover:bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] inline-flex items-center gap-1.5 cursor-pointer transition"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
            <span>Transfer</span>
          </button>
          <button
            type="button"
            onClick={() => openQuickInput({ mode: 'create', type: 'expense' })}
            className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-semibold text-white items-center gap-1.5 cursor-pointer transition"
            style={{ background: 'var(--mw-primary)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Transaksi Baru</span>
          </button>
        </div>
      </div>

      {/* AI Advisor Quick Highlight Strip (or 1-Click Dummy Data Starter when empty) */}
      {dataset.transactions.length === 0 ? (
        <div className="mw-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-[var(--mw-primary-soft)] text-[var(--mw-primary)] flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-[var(--mw-text)]">
                Ingin lihat grafik MoM, Heatmap, Portofolio Bibit 5 Produk, &amp; AI Advisor langsung hidup?
              </div>
              <div className="text-[var(--mw-text-muted)]">
                Coba muat Data Dummy 3 Bulan — bisa dihapus kembali ke 0 dalam 1 klik kapan saja.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={loadThreeMonthDummyData}
            className="px-3.5 py-2 rounded-xl font-semibold text-white shrink-0 cursor-pointer"
            style={{ background: 'var(--mw-primary)' }}
          >
            🧪 Muat Data Dummy 3 Bulan
          </button>
        </div>
      ) : (
        <Link
          href="/advisor"
          className="mw-card rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-[var(--mw-primary)] transition text-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-[var(--mw-primary-soft)] text-[var(--mw-primary)] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-[var(--mw-text)] truncate">
                AI Advisor · Skor {aiReport.score}/100 ({aiReport.scoreLabel})
              </div>
              <div className="text-[var(--mw-text-muted)] truncate">
                {aiReport.cards[0]?.title || aiReport.headline}
              </div>
            </div>
          </div>
          <span className="text-[var(--mw-primary)] font-semibold shrink-0 inline-flex items-center gap-0.5">
            Tanya AI <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      )}

      {/* Top Row: Net Worth Hero + 4 KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Hero Net Worth Card */}
        <div className="lg:col-span-5 mw-hero-gradient rounded-3xl p-5 sm:p-6 text-white flex flex-col justify-between shadow-lg">
          <div className="space-y-1">
            <div className="text-xs font-medium text-emerald-100/80 uppercase tracking-wider">
              Net Worth
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold tab-num tracking-tight">
              {formatIDR(netWorth.netWorth, privacy)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-5 mt-5 border-t border-white/15">
            <div>
              <div className="text-xs text-emerald-100/75">Saldo Liquid</div>
              <div className="text-base font-bold tab-num mt-0.5">
                {formatIDR(netWorth.liquid, privacy)}
              </div>
            </div>
            <Link href="/wallets" className="group">
              <div className="text-xs text-emerald-100/75 flex items-center gap-1.5">
                <span>Investasi (Bibit)</span>
                {bibitSummary && bibitSummary.unrealizedGainPct !== null && (
                  <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-bold">
                    {bibitSummary.unrealizedGain >= 0 ? '+' : ''}
                    {bibitSummary.unrealizedGainPct.toFixed(1).replace('.', ',')}%
                  </span>
                )}
              </div>
              <div className="text-base font-bold tab-num mt-0.5 group-hover:underline">
                {formatIDR(netWorth.investment, privacy)}
              </div>
            </Link>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 gap-3">
          <div className="mw-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--mw-text-muted)]">Income</span>
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--mw-income-soft)', color: 'var(--mw-income)' }}
              >
                <ArrowDownLeft className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl font-bold tab-num" style={{ color: 'var(--mw-income)' }}>
                {formatIDR(periodSummary.income, privacy)}
              </div>
              <div className="text-xs text-[var(--mw-text-dim)] mt-0.5">{periodLabel}</div>
            </div>
          </div>

          <div className="mw-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--mw-text-muted)]">Expense</span>
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--mw-expense-soft)', color: 'var(--mw-expense)' }}
              >
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl font-bold tab-num" style={{ color: 'var(--mw-expense)' }}>
                {formatIDR(periodSummary.expense, privacy)}
              </div>
              <div className="text-xs text-[var(--mw-text-dim)] mt-0.5">
                {periodLabel}
              </div>
            </div>
          </div>

          <div className="mw-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--mw-text-muted)]">Saving (Net)</span>
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--mw-saving-soft)', color: 'var(--mw-saving)' }}
              >
                <PiggyBank className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl font-bold tab-num" style={{ color: 'var(--mw-saving)' }}>
                {formatIDR(periodSummary.savingNet, privacy)}
              </div>
              <div className="text-xs text-[var(--mw-text-dim)] mt-0.5 tab-num">
                Savings Rate: {periodSummary.savingsRate}%
              </div>
            </div>
          </div>

          <div className="mw-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--mw-text-muted)]">Net Cashflow</span>
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--mw-primary-soft)', color: 'var(--mw-primary)' }}
              >
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div
                className="text-lg sm:text-xl font-bold tab-num"
                style={{
                  color:
                    periodSummary.netCashflow >= 0 ? 'var(--mw-text)' : 'var(--mw-expense)',
                }}
              >
                {formatIDR(periodSummary.netCashflow, privacy)}
              </div>
              <div className="text-xs text-[var(--mw-text-dim)] mt-0.5">Income − Expense</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Wallet Strip */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--mw-text)]">Saldo Dompet Live</h2>
          <Link
            href="/wallets"
            className="text-xs font-semibold text-[var(--mw-primary)] inline-flex items-center gap-0.5 hover:underline"
          >
            <span>Lihat semua ({visibleWalletBalances.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto mw-scroll pb-1.5">
          {visibleWalletBalances.slice(0, 8).map((item) => {
            const w = item.wallet;
            return (
              <Link
                key={w.id}
                href={`/wallets?wallet=${w.id}`}
                className="mw-card rounded-2xl p-3.5 min-w-[158px] sm:min-w-[172px] shrink-0 hover:border-[var(--mw-primary)] transition space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `${w.color}22`, color: w.color }}
                  >
                    <DynamicIcon name={w.icon} className="w-4 h-4" />
                  </div>
                  {item.unrealizedGainPct !== null && (
                    <span
                      className="text-xs font-semibold tab-num px-1.5 py-0.5 rounded-md"
                      style={{
                        background:
                          item.unrealizedGain >= 0
                            ? 'var(--mw-income-soft)'
                            : 'var(--mw-expense-soft)',
                        color:
                          item.unrealizedGain >= 0
                            ? 'var(--mw-income)'
                            : 'var(--mw-expense)',
                      }}
                    >
                      {item.unrealizedGain >= 0 ? '+' : ''}
                      {item.unrealizedGainPct.toFixed(1).replace('.', ',')}%
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs text-[var(--mw-text-muted)] truncate">{w.name}</div>
                  <div className="text-sm font-bold tab-num text-[var(--mw-text)] mt-0.5">
                    {formatIDR(item.balance, privacy)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Charts Row: Income vs Expense Bar + Category Donut with Drill-Down */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 mw-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--mw-text)]">
                Income vs Expense (6 Bulan)
              </h2>
              <p className="text-xs text-[var(--mw-text-muted)]">
                Perbandingan arus kas bulanan
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--mw-text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                Income
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                Expense
              </span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--mw-text-dim)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--mw-text-dim)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v === 0 ? '0' : `${Math.round(v / 1000)}rb`)}
                />
                <Tooltip
                  cursor={{ fill: 'var(--mw-surface-2)' }}
                  contentStyle={{
                    background: 'var(--mw-surface)',
                    border: '1px solid var(--mw-border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'var(--mw-text)',
                  }}
                  formatter={(value) => formatIDR(Number(value ?? 0), privacy)}
                />
                <Bar dataKey="income" name="Income" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={24} />
                <Bar dataKey="expense" name="Expense" fill="#f87171" radius={[6, 6, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Donut with Category -> Sub-Category Drill-down */}
        <div className="lg:col-span-5 mw-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--mw-text)]">
                {drillCatId ? `Detail: ${drillCatName}` : 'Komposisi Pengeluaran'}
              </h2>
              <p className="text-xs text-[var(--mw-text-muted)]">
                {drillCatId ? 'Breakdown per sub-kategori' : 'Klik kategori untuk drill-down'}
              </p>
            </div>
            {drillCatId && (
              <button
                type="button"
                onClick={() => setDrillCatId(null)}
                className="px-2.5 py-1 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Semua
              </button>
            )}
          </div>

          {donutData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center px-4 space-y-2">
              <p className="text-xs text-[var(--mw-text-muted)]">
                Belum ada pengeluaran pada periode {periodLabel}.
              </p>
              <button
                type="button"
                onClick={() => openQuickInput({ mode: 'create', type: 'expense' })}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'var(--mw-primary)' }}
              >
                Catat Pengeluaran Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={44}
                      outerRadius={70}
                      paddingAngle={2}
                      onClick={(_, index) => {
                        const target = donutData[index];
                        if (!drillCatId && target) setDrillCatId(target.id);
                      }}
                      className={!drillCatId ? 'cursor-pointer' : ''}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--mw-surface)',
                        border: '1px solid var(--mw-border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--mw-text)',
                      }}
                      formatter={(value) => formatIDR(Number(value ?? 0), privacy)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto mw-scroll pr-1">
                {donutData.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={Boolean(drillCatId)}
                    onClick={() => !drillCatId && setDrillCatId(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-xs ${
                      !drillCatId ? 'hover:bg-[var(--mw-surface-2)] cursor-pointer' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: item.color }}
                      />
                      <span className="text-[var(--mw-text)] truncate">{item.name}</span>
                    </span>
                    <span className="font-semibold tab-num text-[var(--mw-text-muted)] shrink-0">
                      {formatIDRCompact(item.value, privacy)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Budget Bulan Ini + Goals + Transaksi Terakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Budget Progress */}
        <div className="lg:col-span-4 mw-card rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--mw-text)]">Budget Bulan Ini</h2>
            <Link href="/budget" className="text-xs font-semibold text-[var(--mw-primary)] hover:underline">
              Kelola
            </Link>
          </div>
          <div className="space-y-3">
            {criticalBudgets.map((item) => {
              const pct = item.pct ?? 0;
              const barColor =
                item.status === 'over'
                  ? 'var(--mw-expense)'
                  : item.status === 'warn'
                    ? 'var(--mw-warn)'
                    : 'var(--mw-primary)';
              return (
                <div key={item.category.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--mw-text)] truncate">
                      {item.category.name}
                    </span>
                    <span className="tab-num font-semibold" style={{ color: barColor }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--mw-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--mw-text-dim)] tab-num">
                    <span>{formatIDR(item.actual, privacy)}</span>
                    <span>dari {formatIDR(item.effectiveBudget ?? 0, privacy)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goals Preview */}
        <div className="lg:col-span-4 mw-card rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--mw-text)]">Target Tabungan</h2>
            <Link href="/goals" className="text-xs font-semibold text-[var(--mw-primary)] hover:underline">
              Semua
            </Link>
          </div>
          <div className="space-y-3">
            {dataset.goals.slice(0, 3).map((g) => {
              const prog = calculateGoalProgress(
                g,
                dataset.transactions,
                nowDate,
                dataset.goalContributions,
                dataset.investmentProducts
              );
              return (
                <div key={g.id} className="p-3 rounded-xl bg-[var(--mw-surface-2)] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <DynamicIcon name={g.icon} className="w-4 h-4 shrink-0" style={{ color: g.color }} />
                      <span className="text-xs font-semibold text-[var(--mw-text)] truncate">
                        {g.name}
                      </span>
                      {g.isShared && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-[var(--mw-primary-soft)] text-[var(--mw-primary)]">
                          Bersama
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold tab-num text-[var(--mw-primary)]">
                      {prog.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--mw-surface-3)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${prog.pct}%`, background: g.color }}
                    />
                  </div>
                  <div className="text-xs text-[var(--mw-text-muted)] tab-num">
                    {formatIDR(prog.saved, privacy)} / {formatIDR(g.targetAmount, privacy)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-4 mw-card rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--mw-text)]">Transaksi Terakhir</h2>
            <Link
              href="/transactions"
              className="text-xs font-semibold text-[var(--mw-primary)] hover:underline"
            >
              Riwayat
            </Link>
          </div>

          {recentTx.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--mw-text-muted)] space-y-2">
              <p>Belum ada transaksi tercatat.</p>
              <p className="text-[var(--mw-text-dim)]">
                Tekan tombol <b>+</b> (atau tombol <kbd className="font-mono">N</kbd> di desktop) untuk mulai.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentTx.map((tx) => {
                const sub = tx.subcategoryId ? subById.get(tx.subcategoryId) : undefined;
                const cat = sub ? catById.get(sub.categoryId) : undefined;
                const fromW = walletById.get(tx.walletId);
                const toW = tx.toWalletId ? walletById.get(tx.toWalletId) : undefined;

                const title =
                  tx.type === 'transfer'
                    ? `${fromW?.name ?? 'Wallet'} → ${toW?.name ?? 'Wallet'}`
                    : tx.type === 'adjustment'
                      ? `Rekonsiliasi · ${fromW?.name ?? ''}`
                      : sub?.name ?? cat?.name ?? tx.type;

                const color =
                  tx.type === 'income'
                    ? 'var(--mw-income)'
                    : tx.type === 'expense'
                      ? 'var(--mw-expense)'
                      : tx.type === 'saving' || tx.type === 'saving_withdrawal'
                        ? 'var(--mw-saving)'
                        : 'var(--mw-transfer)';

                const sign =
                  tx.type === 'income'
                    ? '+'
                    : tx.type === 'expense'
                      ? '−'
                      : tx.type === 'adjustment'
                        ? tx.amount >= 0
                          ? '+'
                          : '−'
                        : '';

                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => openQuickInput({ mode: 'edit', transaction: tx })}
                    className="w-full p-2.5 rounded-xl hover:bg-[var(--mw-surface-2)] flex items-center justify-between gap-2.5 text-left cursor-pointer transition"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--mw-text)] truncate">
                        {title}
                      </div>
                      <div className="text-xs text-[var(--mw-text-dim)] truncate">
                        {formatDateID(tx.date, today)} · {fromW?.name}
                        {tx.note ? ` · ${tx.note}` : ''}
                      </div>
                    </div>
                    <div className="text-xs font-bold tab-num shrink-0" style={{ color }}>
                      {sign}
                      {formatIDR(Math.abs(tx.amount), privacy)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
