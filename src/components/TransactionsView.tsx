'use client';

import { useMemo, useState } from 'react';
import {
  Copy,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import {
  calculatePeriodSummary,
  formatDateID,
  formatIDR,
  transactionsToCSV,
} from '@/lib/finance';
import { todayISO } from '@/lib/seed';
import type { Transaction, TransactionType } from '@/types/finance';

export function TransactionsView() {
  const {
    dataset,
    periodLabel,
    periodTransactions,
    openQuickInput,
    addTransaction,
    deleteTransaction,
  } = useWallet();

  const today = todayISO();
  const privacy = dataset.profile.privacyMode;

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [walletFilter, setWalletFilter] = useState<string>('all');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...periodTransactions]
      .filter((tx) => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (
          walletFilter !== 'all' &&
          tx.walletId !== walletFilter &&
          tx.toWalletId !== walletFilter
        ) {
          return false;
        }
        if (!q) return true;
        const sub = tx.subcategoryId ? subById.get(tx.subcategoryId) : undefined;
        const cat = sub ? catById.get(sub.categoryId) : undefined;
        const w1 = walletById.get(tx.walletId)?.name ?? '';
        const w2 = tx.toWalletId ? walletById.get(tx.toWalletId)?.name ?? '' : '';
        const hay = `${tx.note} ${sub?.name ?? ''} ${cat?.name ?? ''} ${w1} ${w2}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [catById, periodTransactions, query, subById, typeFilter, walletById, walletFilter]);

  const filteredSummary = useMemo(() => calculatePeriodSummary(filtered), [filtered]);

  // Grouped by date for mobile view
  const groupedByDate = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      const list = map.get(tx.date) ?? [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      dayExpense: calculatePeriodSummary(items).expense,
      dayIncome: calculatePeriodSummary(items).income,
    }));
  }, [filtered]);

  const handleDuplicate = (tx: Transaction) => {
    addTransaction({
      date: today,
      type: tx.type,
      subcategoryId: tx.subcategoryId,
      walletId: tx.walletId,
      toWalletId: tx.toWalletId,
      amount: tx.amount,
      fee: tx.fee,
      goalId: tx.goalId,
      note: tx.note,
    });
  };

  const handleExportCSV = () => {
    const csv = transactionsToCSV(
      filtered,
      dataset.wallets,
      dataset.categories,
      dataset.subcategories
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-wallet-transaksi-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderTxMeta = (tx: Transaction) => {
    const sub = tx.subcategoryId ? subById.get(tx.subcategoryId) : undefined;
    const cat = sub ? catById.get(sub.categoryId) : undefined;
    const fromW = walletById.get(tx.walletId);
    const toW = tx.toWalletId ? walletById.get(tx.toWalletId) : undefined;

    const title =
      tx.type === 'transfer'
        ? `Transfer: ${fromW?.name ?? ''} → ${toW?.name ?? ''}`
        : tx.type === 'adjustment'
          ? `Rekonsiliasi Saldo`
          : sub && cat
            ? `${cat.name} › ${sub.name}`
            : tx.type;

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

    return { title, cat, fromW, toW, color, sign };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
            Riwayat Transaksi
          </h1>
          <p className="text-xs text-[var(--mw-text-muted)]">
            {periodLabel} · {filtered.length} transaksi ditampilkan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--mw-surface)] hover:bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => openQuickInput({ mode: 'create' })}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ background: 'var(--mw-primary)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Catat</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mw-card rounded-2xl p-3.5 flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mw-text-dim)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari catatan, kategori, atau dompet..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | TransactionType)}
            className="flex-1 md:flex-none px-3 py-2 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Tipe</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="saving">Saving</option>
            <option value="saving_withdrawal">Tarik Tabungan</option>
            <option value="transfer">Transfer</option>
            <option value="adjustment">Rekonsiliasi</option>
          </select>

          <select
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            className="flex-1 md:flex-none px-3 py-2 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Wallet</option>
            {dataset.wallets
              .filter((w) => !w.hidden && !w.archived)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Filtered Summary Strip */}
      <div className="grid grid-cols-3 gap-2.5 text-xs">
        <div className="mw-card rounded-2xl p-3">
          <div className="text-[var(--mw-text-dim)]">Income</div>
          <div className="font-bold tab-num text-sm mt-0.5" style={{ color: 'var(--mw-income)' }}>
            {formatIDR(filteredSummary.income, privacy)}
          </div>
        </div>
        <div className="mw-card rounded-2xl p-3">
          <div className="text-[var(--mw-text-dim)]">Expense</div>
          <div className="font-bold tab-num text-sm mt-0.5" style={{ color: 'var(--mw-expense)' }}>
            {formatIDR(filteredSummary.expense, privacy)}
          </div>
        </div>
        <div className="mw-card rounded-2xl p-3">
          <div className="text-[var(--mw-text-dim)]">Saving Net</div>
          <div className="font-bold tab-num text-sm mt-0.5" style={{ color: 'var(--mw-saving)' }}>
            {formatIDR(filteredSummary.savingNet, privacy)}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mw-card rounded-2xl py-14 px-6 text-center space-y-3">
          <p className="text-sm font-medium text-[var(--mw-text)]">Belum ada transaksi yang cocok</p>
          <p className="text-xs text-[var(--mw-text-muted)]">
            Ubah filter atau catat transaksi pertamamu sekarang.
          </p>
          <button
            type="button"
            onClick={() => openQuickInput({ mode: 'create' })}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
            style={{ background: 'var(--mw-primary)' }}
          >
            + Catat Transaksi
          </button>
        </div>
      ) : (
        <>
          {/* MOBILE GROUPED DAILY LIST (< md) */}
          <div className="md:hidden space-y-4">
            {groupedByDate.map((group) => (
              <div key={group.date} className="space-y-2">
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="font-semibold text-[var(--mw-text)]">
                    {formatDateID(group.date, today)}
                  </span>
                  <span className="tab-num text-[var(--mw-text-muted)]">
                    {group.dayExpense > 0 ? `−${formatIDR(group.dayExpense, privacy)}` : ''}
                    {group.dayIncome > 0
                      ? `${group.dayExpense > 0 ? ' · ' : ''}+${formatIDR(group.dayIncome, privacy)}`
                      : ''}
                  </span>
                </div>

                <div className="mw-card rounded-2xl divide-y divide-[var(--mw-border)] overflow-hidden">
                  {group.items.map((tx) => {
                    const { title, cat, fromW, color, sign } = renderTxMeta(tx);
                    return (
                      <div key={tx.id} className="p-3.5 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => openQuickInput({ mode: 'edit', transaction: tx })}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: cat ? `${cat.color}22` : 'var(--mw-surface-2)',
                              color: cat ? cat.color : color,
                            }}
                          >
                            <DynamicIcon name={cat?.icon ?? 'wallet'} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--mw-text)] truncate">
                              {title}
                            </div>
                            <div className="text-xs text-[var(--mw-text-dim)] truncate">
                              {fromW?.name}
                              {tx.note ? ` · ${tx.note}` : ''}
                              {tx.fee > 0 ? ` · Admin ${formatIDR(tx.fee, privacy)}` : ''}
                            </div>
                          </div>
                        </button>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-xs font-bold tab-num" style={{ color }}>
                            {sign}
                            {formatIDR(Math.abs(tx.amount), privacy)}
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleDuplicate(tx)}
                              aria-label="Duplikat"
                              className="text-[var(--mw-text-dim)] hover:text-[var(--mw-text)] cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTransaction(tx.id)}
                              aria-label="Hapus"
                              className="text-[var(--mw-text-dim)] hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP TABLE (>= md) */}
          <div className="hidden md:block mw-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--mw-border)] text-xs text-[var(--mw-text-muted)] bg-[var(--mw-surface-2)]">
                    <th className="py-3 px-4 font-semibold">Tanggal</th>
                    <th className="py-3 px-4 font-semibold">Kategori / Keterangan</th>
                    <th className="py-3 px-4 font-semibold">Wallet</th>
                    <th className="py-3 px-4 font-semibold">Catatan</th>
                    <th className="py-3 px-4 font-semibold text-right">Nominal</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--mw-border)] text-xs">
                  {filtered.map((tx) => {
                    const { title, cat, fromW, toW, color, sign } = renderTxMeta(tx);
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-[var(--mw-surface-2)]/70 transition"
                      >
                        <td className="py-3 px-4 whitespace-nowrap text-[var(--mw-text-muted)] tab-num">
                          {formatDateID(tx.date, today)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{
                                background: cat ? `${cat.color}22` : 'var(--mw-surface-2)',
                                color: cat ? cat.color : color,
                              }}
                            >
                              <DynamicIcon name={cat?.icon ?? 'wallet'} className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-semibold text-[var(--mw-text)]">{title}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-[var(--mw-text-muted)]">
                          {fromW?.name}
                          {toW ? ` → ${toW.name}` : ''}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-[var(--mw-text-muted)]">
                          {tx.note || '—'}
                          {tx.fee > 0 && (
                            <span className="ml-1.5 text-[var(--mw-text-dim)]">
                              (Admin {formatIDR(tx.fee, privacy)})
                            </span>
                          )}
                        </td>
                        <td
                          className="py-3 px-4 whitespace-nowrap text-right font-bold tab-num"
                          style={{ color }}
                        >
                          {sign}
                          {formatIDR(Math.abs(tx.amount), privacy)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openQuickInput({ mode: 'edit', transaction: tx })}
                              title="Edit"
                              className="p-1.5 rounded-lg hover:bg-[var(--mw-surface-3)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(tx)}
                              title="Duplikat ke hari ini"
                              className="p-1.5 rounded-lg hover:bg-[var(--mw-surface-3)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTransaction(tx.id)}
                              title="Hapus"
                              className="p-1.5 rounded-lg hover:bg-red-500/15 text-[var(--mw-text-muted)] hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
