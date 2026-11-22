'use client';

import { useMemo, useState } from 'react';
import { Calendar, Flame, TrendingDown, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWallet } from '@/context/WalletContext';
import {
  buildDailyExpenseHeatmap,
  buildMonthlyTrend,
  calculateMoMComparison,
  calculateYoYComparison,
  formatDateID,
  formatIDR,
  formatIDRCompact,
} from '@/lib/finance';

export function AnalyticsView() {
  const { dataset, nowDate, loadThreeMonthDummyData } = useWallet();
  const privacy = dataset.profile.privacyMode;
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const mom = useMemo(
    () =>
      calculateMoMComparison(
        dataset.transactions,
        dataset.categories,
        dataset.subcategories,
        nowDate
      ),
    [dataset.categories, dataset.subcategories, dataset.transactions, nowDate]
  );

  const yoy = useMemo(
    () => calculateYoYComparison(dataset.transactions, nowDate),
    [dataset.transactions, nowDate]
  );

  const trend = useMemo(
    () => buildMonthlyTrend(dataset.transactions, 6, nowDate),
    [dataset.transactions, nowDate]
  );

  const heatmap = useMemo(
    () => buildDailyExpenseHeatmap(dataset.transactions, 84, nowDate),
    [dataset.transactions, nowDate]
  );

  const subById = useMemo(
    () => new Map(dataset.subcategories.map((s) => [s.id, s])),
    [dataset.subcategories]
  );

  const selectedDayInfo = useMemo(() => {
    if (!selectedDay) return null;
    const dayCell = heatmap.find((d) => d.date === selectedDay);
    const txs = dataset.transactions.filter(
      (t) =>
        t.date === selectedDay &&
        (t.type === 'expense' || (t.type === 'transfer' && t.fee > 0))
    );
    return { dayCell, txs };
  }, [dataset.transactions, heatmap, selectedDay]);

  const heatmapColors: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: 'var(--mw-surface-2)',
    1: 'rgba(16, 185, 129, 0.30)',
    2: 'rgba(20, 184, 166, 0.60)',
    3: 'rgba(245, 158, 11, 0.75)',
    4: 'rgba(244, 63, 94, 0.85)',
  };

  // Group heatmap into 12 columns (weeks) of 7 days
  const weeks = useMemo(() => {
    const cols: typeof heatmap[] = [];
    for (let i = 0; i < heatmap.length; i += 7) {
      cols.push(heatmap.slice(i, i + 7));
    }
    return cols;
  }, [heatmap]);

  const busiestDay = useMemo(() => {
    return [...heatmap].sort((a, b) => b.amount - a.amount)[0] ?? null;
  }, [heatmap]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
            Analitik Tren &amp; Heatmap
          </h1>
          <p className="text-xs text-[var(--mw-text-muted)]">
            Perbandingan bulan-ke-bulan (MoM), tahunan (YoY), dan kalender intensitas pengeluaran harian
          </p>
        </div>

        {dataset.transactions.length === 0 && (
          <button
            type="button"
            onClick={loadThreeMonthDummyData}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
            style={{ background: 'var(--mw-primary)' }}
          >
            🧪 Muat Data Dummy 3 Bulan
          </button>
        )}
      </div>

      {/* MoM Comparison Cards */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--mw-text-muted)]">
            Perbandingan MoM · {mom.currentLabel} vs {mom.previousLabel}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'Income',
              data: mom.income,
              color: 'var(--mw-income)',
              goodWhenUp: true,
            },
            {
              label: 'Expense',
              data: mom.expense,
              color: 'var(--mw-expense)',
              goodWhenUp: false,
            },
            {
              label: 'Saving Net',
              data: mom.saving,
              color: 'var(--mw-saving)',
              goodWhenUp: true,
            },
            {
              label: 'Net Cashflow',
              data: mom.netCashflow,
              color: 'var(--mw-primary)',
              goodWhenUp: true,
            },
          ].map((card) => {
            const up = card.data.diff >= 0;
            const positiveBadge = card.goodWhenUp ? up : !up;
            return (
              <div key={card.label} className="mw-card rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--mw-text-muted)] font-medium">{card.label}</span>
                  {card.data.pct !== null && (
                    <span
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold tab-num"
                      style={{
                        background: positiveBadge
                          ? 'var(--mw-income-soft)'
                          : 'var(--mw-expense-soft)',
                        color: positiveBadge ? 'var(--mw-income)' : 'var(--mw-expense)',
                      }}
                    >
                      {up ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {up ? '+' : ''}
                      {card.data.pct}%
                    </span>
                  )}
                </div>
                <div className="text-lg font-extrabold tab-num" style={{ color: card.color }}>
                  {formatIDR(card.data.current, privacy)}
                </div>
                <div className="text-[11px] text-[var(--mw-text-dim)] tab-num">
                  Bulan lalu: {formatIDR(card.data.previous, privacy)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Multi-Month Trend Line Chart + YoY Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 mw-card rounded-3xl p-5 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--mw-text)]">
              Tren Arus Kas 6 Bulan (Income · Expense · Saving)
            </h2>
            <p className="text-xs text-[var(--mw-text-dim)]">
              Pantau kestabilan pemasukan, pengeluaran, dan porsi tabungan tiap bulan
            </p>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mw-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--mw-text-dim)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--mw-text-dim)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatIDRCompact(Number(v), privacy)}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--mw-surface)',
                    border: '1px solid var(--mw-border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(v, name) => [
                    formatIDR(Number(v ?? 0), privacy),
                    name === 'income' ? 'Income' : name === 'expense' ? 'Expense' : 'Saving',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px' }}
                  formatter={(v) => (v === 'income' ? 'Income' : v === 'expense' ? 'Expense' : 'Saving')}
                />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3.5 }} />
                <Line type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3.5 }} />
                <Line type="monotone" dataKey="saving" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* YoY Card */}
        <div className="lg:col-span-4 mw-card rounded-3xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--mw-primary)]" />
              <h2 className="text-sm font-bold text-[var(--mw-text)]">
                Ringkasan Tahunan (YoY · {yoy.currentYear})
              </h2>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] flex items-center justify-between">
                <span className="text-[var(--mw-text-muted)]">Total Income {yoy.currentYear}</span>
                <span className="font-bold tab-num text-[var(--mw-income)]">
                  {formatIDR(yoy.income.current, privacy)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] flex items-center justify-between">
                <span className="text-[var(--mw-text-muted)]">Total Expense {yoy.currentYear}</span>
                <span className="font-bold tab-num text-[var(--mw-expense)]">
                  {formatIDR(yoy.expense.current, privacy)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] flex items-center justify-between">
                <span className="text-[var(--mw-text-muted)]">Total Saving {yoy.currentYear}</span>
                <span className="font-bold tab-num text-[var(--mw-saving)]">
                  {formatIDR(yoy.saving.current, privacy)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-xs text-[var(--mw-text-muted)]">
            {yoy.hasPreviousYearData ? (
              <span>
                Dibanding {yoy.previousYear}: Expense{' '}
                <b className="text-[var(--mw-text)]">
                  {yoy.expense.pct !== null ? `${yoy.expense.pct > 0 ? '+' : ''}${yoy.expense.pct}%` : '-'}
                </b>
                , Saving{' '}
                <b className="text-[var(--mw-text)]">
                  {yoy.saving.pct !== null ? `${yoy.saving.pct > 0 ? '+' : ''}${yoy.saving.pct}%` : '-'}
                </b>
                .
              </span>
            ) : (
              <span>
                Perbandingan delta YoY dengan tahun {yoy.previousYear} akan muncul otomatis begitu data lintas tahun tersedia.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Daily Expense Heatmap (84 Days / 12 Weeks) */}
      <section className="mw-card rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[var(--mw-expense)]" />
              <h2 className="text-sm font-bold text-[var(--mw-text)]">
                Heatmap Pengeluaran Harian (12 Minggu Terakhir)
              </h2>
            </div>
            <p className="text-xs text-[var(--mw-text-muted)] mt-0.5">
              Klik kotak tanggal untuk melihat rincian pengeluaran hari tersebut.
              {busiestDay && busiestDay.amount > 0
                ? ` Hari terbesar: ${formatDateID(busiestDay.date)} (${formatIDR(busiestDay.amount, privacy)}).`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--mw-text-dim)]">
            <span>Hemat</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span
                key={lvl}
                className="w-3.5 h-3.5 rounded"
                style={{ background: heatmapColors[lvl] }}
              />
            ))}
            <span>Tinggi</span>
          </div>
        </div>

        <div className="overflow-x-auto mw-scroll pb-1">
          <div className="inline-flex gap-1.5 min-w-max">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-rows-7 gap-1.5">
                {week.map((day) => {
                  const isSel = selectedDay === day.date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDay(isSel ? null : day.date)}
                      title={`${formatDateID(day.date)}: ${formatIDR(day.amount, privacy)} (${day.count} transaksi)`}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-md transition cursor-pointer flex items-center justify-center text-[10px] font-medium"
                      style={{
                        background: heatmapColors[day.level],
                        outline: isSel ? '2px solid var(--mw-primary)' : 'none',
                        color: day.level >= 3 ? '#fff' : 'var(--mw-text-dim)',
                      }}
                    >
                      {day.date.slice(8)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {selectedDayInfo && (
          <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--mw-text)]">
                Detail {formatDateID(selectedDay!)}
              </span>
              <span className="font-bold tab-num text-[var(--mw-expense)]">
                Total {formatIDR(selectedDayInfo.dayCell?.amount ?? 0, privacy)}
              </span>
            </div>
            {selectedDayInfo.txs.length === 0 ? (
              <div className="text-[var(--mw-text-muted)]">
                Tidak ada pengeluaran di tanggal ini — hari hemat!
              </div>
            ) : (
              <div className="divide-y divide-[var(--mw-border)]">
                {selectedDayInfo.txs.map((t) => (
                  <div key={t.id} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[var(--mw-text)] truncate">
                      {t.subcategoryId ? subById.get(t.subcategoryId)?.name : 'Biaya Admin'}{' '}
                      {t.note ? `· ${t.note}` : ''}
                    </span>
                    <span className="font-semibold tab-num text-[var(--mw-expense)] shrink-0">
                      -{formatIDR(t.type === 'expense' ? t.amount : t.fee, privacy)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Category MoM Shift Table */}
      {mom.categoryChanges.length > 0 && (
        <section className="mw-card rounded-3xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-[var(--mw-text)]">
            Perubahan Pengeluaran per Kategori ({mom.currentLabel} vs {mom.previousLabel})
          </h2>
          <div className="divide-y divide-[var(--mw-border)] text-xs">
            {mom.categoryChanges.slice(0, 8).map((c) => (
              <div key={c.categoryId} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: c.color }}
                  />
                  <span className="font-semibold text-[var(--mw-text)] truncate">
                    {c.categoryName}
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0 tab-num">
                  <span className="text-[var(--mw-text-dim)] hidden sm:inline">
                    Lalu: {formatIDR(c.previous, privacy)}
                  </span>
                  <span className="font-bold text-[var(--mw-text)]">
                    {formatIDR(c.current, privacy)}
                  </span>
                  <span
                    className="font-bold min-w-[76px] text-right"
                    style={{
                      color: c.diff <= 0 ? 'var(--mw-income)' : 'var(--mw-expense)',
                    }}
                  >
                    {c.diff > 0 ? '+' : ''}
                    {formatIDR(c.diff, privacy)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
