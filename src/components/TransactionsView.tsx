'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Pencil,
  Plus,
  Repeat,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import {
  calculatePeriodSummary,
  formatDateID,
  formatIDR,
  parseAmountExpression,
  transactionsToCSV,
} from '@/lib/finance';
import { todayISO } from '@/lib/seed';
import type { RecurringRule, Transaction, TransactionType } from '@/types/finance';

export function TransactionsView() {
  const {
    dataset,
    periodLabel,
    periodTransactions,
    openQuickInput,
    addTransaction,
    deleteTransaction,
    addRecurringRule,
    toggleRecurringRule,
    deleteRecurringRule,
    executeRecurringRule,
  } = useWallet();

  const today = todayISO();
  const privacy = dataset.profile.privacyMode;

  const [viewTab, setViewTab] = useState<'history' | 'recurring'>('history');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [walletFilter, setWalletFilter] = useState<string>('all');

  // Add recurring rule modal state
  const [showRecModal, setShowRecModal] = useState(false);
  const [recLabel, setRecLabel] = useState('');
  const [recType, setRecType] = useState<RecurringRule['type']>('expense');
  const [recAmt, setRecAmt] = useState('');
  const [recWalletId, setRecWalletId] = useState(
    () => dataset.wallets.find((w) => w.name === 'Jago')?.id ?? dataset.wallets[0]?.id ?? ''
  );
  const [recToWalletId, setRecToWalletId] = useState(
    () => dataset.wallets.find((w) => w.group === 'investment')?.id ?? ''
  );
  const [recSubId, setRecSubId] = useState('');
  const [recDay, setRecDay] = useState('1');
  const [recFreq, setRecFreq] = useState<RecurringRule['frequency']>('monthly');

  const dueCount = useMemo(
    () => dataset.recurringRules.filter((r) => r.active && r.nextRun <= today).length,
    [dataset.recurringRules, today]
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
      investmentProductId: tx.investmentProductId ?? null,
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

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseAmountExpression(recAmt).value;
    if (!recLabel.trim() || amount <= 0 || !recWalletId) return;
    const dayNum = Math.min(28, Math.max(1, Number(recDay) || 1));
    const now = new Date();
    const nextRun = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    addRecurringRule({
      label: recLabel.trim(),
      type: recType,
      amount,
      subcategoryId: recType === 'transfer' ? null : recSubId || null,
      walletId: recWalletId,
      toWalletId: recType === 'transfer' || recType === 'saving' ? recToWalletId || null : null,
      goalId:
        recType === 'saving'
          ? dataset.goals.find((g) => g.isShared)?.id ?? dataset.goals[0]?.id ?? null
          : null,
      note: recLabel.trim(),
      frequency: recFreq,
      dayOfMonth: dayNum,
      nextRun,
      active: true,
    });
    setRecLabel('');
    setRecAmt('');
    setShowRecModal(false);
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
            {viewTab === 'history' ? 'Riwayat Transaksi' : 'Transaksi Berulang'}
          </h1>
          <p className="text-xs text-[var(--mw-text-muted)]">
            {viewTab === 'history'
              ? `${periodLabel} · ${filtered.length} transaksi ditampilkan`
              : `${dataset.recurringRules.length} jadwal rutin · ${dueCount} jatuh tempo`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewTab('history')}
              className="px-3 py-1.5 rounded-lg cursor-pointer transition"
              style={{
                background: viewTab === 'history' ? 'var(--mw-primary-soft)' : 'transparent',
                color: viewTab === 'history' ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
              }}
            >
              Riwayat
            </button>
            <button
              type="button"
              onClick={() => setViewTab('recurring')}
              className="px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition"
              style={{
                background: viewTab === 'recurring' ? 'var(--mw-primary-soft)' : 'transparent',
                color: viewTab === 'recurring' ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
              }}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Berulang</span>
              {dueCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white">
                  {dueCount}
                </span>
              )}
            </button>
          </div>

          {viewTab === 'history' ? (
            <>
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
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowRecModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ background: 'var(--mw-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Jadwal Rutin</span>
            </button>
          )}
        </div>
      </div>

      {viewTab === 'recurring' ? (
        <div className="space-y-3">
          {dataset.recurringRules.length === 0 ? (
            <div className="mw-card rounded-3xl p-10 text-center space-y-2 text-xs text-[var(--mw-text-muted)]">
              <p className="text-sm font-semibold text-[var(--mw-text)]">
                Belum ada jadwal transaksi berulang
              </p>
              <p>
                Tambahkan jadwal rutin seperti Gaji bulanan, Kos, Internet, Langganan, atau Setoran Wedding agar tinggal 1-klik catat setiap bulan.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dataset.recurringRules.map((rule) => {
                const isDue = rule.active && rule.nextRun <= today;
                const wName = walletById.get(rule.walletId)?.name ?? '';
                const toName = rule.toWalletId ? walletById.get(rule.toWalletId)?.name : null;
                const typeCol =
                  rule.type === 'income'
                    ? 'var(--mw-income)'
                    : rule.type === 'expense'
                      ? 'var(--mw-expense)'
                      : rule.type === 'saving'
                        ? 'var(--mw-saving)'
                        : 'var(--mw-transfer)';
                return (
                  <div
                    key={rule.id}
                    className="mw-card rounded-2xl p-4 space-y-3 text-xs flex flex-col justify-between"
                    style={{ opacity: rule.active ? 1 : 0.6 }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[var(--mw-text)] truncate">
                            {rule.label}
                          </span>
                          {isDue && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: 'var(--mw-warn-soft)', color: 'var(--mw-warn)' }}
                            >
                              Jatuh Tempo
                            </span>
                          )}
                        </div>
                        <div className="text-[var(--mw-text-muted)]">
                          {wName}
                          {toName ? ` → ${toName}` : ''} · Setiap{' '}
                          {rule.frequency === 'monthly' ? `tgl ${rule.dayOfMonth}` : rule.frequency}
                        </div>
                        <div className="text-[11px] text-[var(--mw-text-dim)]">
                          Jadwal berikutnya: <b>{formatDateID(rule.nextRun)}</b>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold tab-num" style={{ color: typeCol }}>
                          {formatIDR(rule.amount, privacy)}
                        </div>
                        <div className="text-[11px] uppercase text-[var(--mw-text-dim)]">
                          {rule.type}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--mw-border)]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleRecurringRule(rule.id)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer"
                        >
                          {rule.active ? 'Aktif' : 'Nonaktif'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRecurringRule(rule.id)}
                          className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-dim)] hover:text-red-400 cursor-pointer"
                          title="Hapus jadwal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => executeRecurringRule(rule.id)}
                        className="px-3 py-1.5 rounded-xl font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
                        style={{ background: 'var(--mw-primary)' }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Catat Sekarang</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showRecModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'var(--mw-backdrop)' }}
            >
              <form
                onSubmit={handleCreateRecurring}
                className="w-full max-w-md mw-card rounded-3xl p-5 space-y-4 animate-sheet-up"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[var(--mw-text)]">
                    Tambah Jadwal Transaksi Berulang
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowRecModal(false)}
                    className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[var(--mw-text-muted)] mb-1">Nama Jadwal</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={recLabel}
                      onChange={(e) => setRecLabel(e.target.value)}
                      placeholder="Mis. Bayar Kos, Gaji, Setoran Wedding"
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[var(--mw-text-muted)] mb-1">Tipe</label>
                      <select
                        value={recType}
                        onChange={(e) => setRecType(e.target.value as RecurringRule['type'])}
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="saving">Saving</option>
                        <option value="transfer">Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--mw-text-muted)] mb-1">Nominal</label>
                      <input
                        type="text"
                        required
                        value={recAmt}
                        onChange={(e) => setRecAmt(e.target.value)}
                        placeholder="Mis. 950rb atau 6jt"
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[var(--mw-text-muted)] mb-1">Wallet Utama</label>
                      <select
                        value={recWalletId}
                        onChange={(e) => setRecWalletId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                      >
                        {dataset.wallets
                          .filter((w) => !w.hidden)
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    {recType === 'saving' || recType === 'transfer' ? (
                      <div>
                        <label className="block text-[var(--mw-text-muted)] mb-1">Ke Wallet</label>
                        <select
                          value={recToWalletId}
                          onChange={(e) => setRecToWalletId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                        >
                          {dataset.wallets
                            .filter((w) => !w.hidden)
                            .map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[var(--mw-text-muted)] mb-1">Sub-Kategori</label>
                        <select
                          value={recSubId}
                          onChange={(e) => setRecSubId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                        >
                          <option value="">Pilih sub-kategori...</option>
                          {dataset.subcategories
                            .filter((s) => {
                              const c = catById.get(s.categoryId);
                              return c?.type === recType && !s.archived;
                            })
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {catById.get(s.categoryId)?.name} › {s.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[var(--mw-text-muted)] mb-1">Frekuensi</label>
                      <select
                        value={recFreq}
                        onChange={(e) => setRecFreq(e.target.value as RecurringRule['frequency'])}
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                      >
                        <option value="monthly">Bulanan</option>
                        <option value="weekly">Mingguan</option>
                        <option value="yearly">Tahunan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[var(--mw-text-muted)] mb-1">Tanggal (1–28)</label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={recDay}
                        onChange={(e) => setRecDay(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRecModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                    style={{ background: 'var(--mw-primary)' }}
                  >
                    Simpan Jadwal
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        <>

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
        </>
      )}
    </div>
  );
}
