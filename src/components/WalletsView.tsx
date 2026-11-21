'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Plus,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import {
  buildWalletHistory30Days,
  formatDateID,
  formatIDR,
  parseAmountExpression,
} from '@/lib/finance';
import { todayISO, WALLET_GROUP_LABELS, WALLET_GROUP_ORDER } from '@/lib/seed';
import type { WalletGroup } from '@/types/finance';

export function WalletsView() {
  const {
    dataset,
    walletBalances,
    visibleWalletBalances,
    netWorth,
    openQuickInput,
    reconcileWallet,
    addValuation,
    addWallet,
    updateWallet,
  } = useWallet();

  const privacy = dataset.profile.privacyMode;
  const today = todayISO();

  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('wallet');
  });
  const [reconcileInput, setReconcileInput] = useState('');
  const [valuationInput, setValuationInput] = useState('');
  const [showAddWallet, setShowAddWallet] = useState(false);

  // Add wallet form state
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<WalletGroup>('bank');
  const [newOpening, setNewOpening] = useState('');

  const selectedBalance = useMemo(
    () => walletBalances.find((b) => b.wallet.id === selectedWalletId) ?? null,
    [selectedWalletId, walletBalances]
  );

  const selectedHistory = useMemo(() => {
    if (!selectedBalance) return [];
    return buildWalletHistory30Days(selectedBalance.wallet, dataset.transactions);
  }, [dataset.transactions, selectedBalance]);

  const selectedMutations = useMemo(() => {
    if (!selectedWalletId) return [];
    return [...dataset.transactions]
      .filter((t) => t.walletId === selectedWalletId || t.toWalletId === selectedWalletId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [dataset.transactions, selectedWalletId]);

  const subById = useMemo(
    () => new Map(dataset.subcategories.map((s) => [s.id, s])),
    [dataset.subcategories]
  );
  const walletById = useMemo(
    () => new Map(dataset.wallets.map((w) => [w.id, w])),
    [dataset.wallets]
  );

  const hiddenCreditWallet = useMemo(
    () => dataset.wallets.find((w) => w.group === 'credit' && w.hidden),
    [dataset.wallets]
  );

  const handleReconcile = () => {
    if (!selectedBalance || !reconcileInput.trim()) return;
    const actual = parseAmountExpression(reconcileInput).value;
    reconcileWallet(selectedBalance.wallet.id, actual);
    setReconcileInput('');
  };

  const handleUpdateValuation = () => {
    if (!selectedBalance || !valuationInput.trim()) return;
    const val = parseAmountExpression(valuationInput).value;
    if (val <= 0) return;
    addValuation(selectedBalance.wallet.id, val);
    setValuationInput('');
  };

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const iconByGroup: Record<WalletGroup, string> = {
      cash: 'banknote',
      bank: 'landmark',
      ewallet: 'smartphone',
      emoney: 'credit-card',
      investment: 'trending-up',
      credit: 'credit-card',
    };
    const colorByGroup: Record<WalletGroup, string> = {
      cash: '#10b981',
      bank: '#0284c7',
      ewallet: '#06b6d4',
      emoney: '#2563eb',
      investment: '#10b981',
      credit: '#64748b',
    };
    addWallet({
      name: newName.trim(),
      group: newGroup,
      kind: newGroup === 'credit' ? 'liability' : 'asset',
      openingBalance: parseAmountExpression(newOpening).value,
      openingDate: today,
      icon: iconByGroup[newGroup],
      color: colorByGroup[newGroup],
      includeInTotal: true,
      hidden: false,
      archived: false,
    });
    setNewName('');
    setNewOpening('');
    setShowAddWallet(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
            Dompet &amp; Transfer
          </h1>
          <p className="text-xs text-[var(--mw-text-muted)]">
            Saldo dihitung otomatis dari saldo awal dan seluruh transaksi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openQuickInput({ mode: 'create', type: 'transfer' })}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ background: 'var(--mw-primary)' }}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfer Antar Wallet</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddWallet(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--mw-surface)] hover:bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Wallet</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="mw-hero-gradient rounded-2xl p-4 text-white">
          <div className="text-xs text-emerald-100/80">Net Worth</div>
          <div className="text-2xl font-extrabold tab-num mt-1">
            {formatIDR(netWorth.netWorth, privacy)}
          </div>
        </div>
        <div className="mw-card rounded-2xl p-4">
          <div className="text-xs text-[var(--mw-text-muted)]">Total Liquid (Siap Pakai)</div>
          <div className="text-xl font-bold tab-num text-[var(--mw-text)] mt-1">
            {formatIDR(netWorth.liquid, privacy)}
          </div>
        </div>
        <div className="mw-card rounded-2xl p-4">
          <div className="text-xs text-[var(--mw-text-muted)]">Aset Investasi</div>
          <div className="text-xl font-bold tab-num text-[var(--mw-primary)] mt-1">
            {formatIDR(netWorth.investment, privacy)}
          </div>
        </div>
      </div>

      {/* Grouped Wallet Cards */}
      <div className="space-y-5">
        {WALLET_GROUP_ORDER.map((grp) => {
          const items = visibleWalletBalances.filter((b) => b.wallet.group === grp);
          if (items.length === 0) return null;
          const subtotal = items.reduce((sum, b) => sum + b.balance, 0);

          return (
            <section key={grp} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--mw-text-muted)]">
                  {WALLET_GROUP_LABELS[grp]}
                </h2>
                <span className="text-xs font-semibold tab-num text-[var(--mw-text-dim)]">
                  Subtotal {formatIDR(subtotal, privacy)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item) => {
                  const w = item.wallet;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setSelectedWalletId(w.id);
                        setReconcileInput('');
                        setValuationInput('');
                      }}
                      className="mw-card rounded-2xl p-4 text-left hover:border-[var(--mw-primary)] transition cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${w.color}22`, color: w.color }}
                        >
                          <DynamicIcon name={w.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--mw-text)] truncate">
                            {w.name}
                          </div>
                          {item.lastValuationDate ? (
                            <div className="text-xs text-[var(--mw-primary)] tab-num">
                              {item.unrealizedGain >= 0 ? '+' : ''}
                              {formatIDR(item.unrealizedGain, privacy)}
                            </div>
                          ) : (
                            <div className="text-xs text-[var(--mw-text-dim)]">
                              Ketuk untuk mutasi &amp; rekonsiliasi
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className="text-sm font-bold tab-num"
                          style={{
                            color: item.balance < 0 ? 'var(--mw-expense)' : 'var(--mw-text)',
                          }}
                        >
                          {formatIDR(item.balance, privacy)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Hidden Credit Card Notice */}
      {hiddenCreditWallet && (
        <div className="p-4 rounded-2xl bg-[var(--mw-surface)] border border-[var(--mw-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-[var(--mw-text-muted)]">
            Wallet tipe <b>Kartu Kredit (Liability)</b> sudah disiapkan namun disembunyikan karena belum dipakai.
          </div>
          <button
            type="button"
            onClick={() => updateWallet({ ...hiddenCreditWallet, hidden: false })}
            className="px-3 py-1.5 rounded-xl font-semibold bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] text-[var(--mw-text)] cursor-pointer"
          >
            Aktifkan Kartu Kredit
          </button>
        </div>
      )}

      {/* WALLET DETAIL / MUTATION / RECONCILE DRAWER */}
      {selectedBalance && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <div className="flex-1" onClick={() => setSelectedWalletId(null)} />
          <div className="w-full md:w-[460px] max-h-[90dvh] md:max-h-none md:h-full bg-[var(--mw-surface)] rounded-t-3xl md:rounded-none md:border-l border-t md:border-t-0 border-[var(--mw-border)] flex flex-col animate-sheet-up md:animate-panel-right overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--mw-border)]">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: `${selectedBalance.wallet.color}22`,
                    color: selectedBalance.wallet.color,
                  }}
                >
                  <DynamicIcon name={selectedBalance.wallet.icon} className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--mw-text)]">
                    {selectedBalance.wallet.name}
                  </h2>
                  <div className="text-xs text-[var(--mw-text-muted)]">
                    {WALLET_GROUP_LABELS[selectedBalance.wallet.group]} · Saldo awal{' '}
                    {formatIDR(selectedBalance.wallet.openingBalance, privacy)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWalletId(null)}
                className="p-2 rounded-xl bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mw-scroll p-5 space-y-5">
              {/* Current Balance + Quick Transfer */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[var(--mw-text-muted)]">Saldo Terkini</div>
                  <div className="text-2xl font-extrabold tab-num text-[var(--mw-text)]">
                    {formatIDR(selectedBalance.balance, privacy)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedBalance.wallet.id;
                    setSelectedWalletId(null);
                    openQuickInput({ mode: 'create', type: 'transfer', walletId: id });
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  style={{ background: 'var(--mw-primary)' }}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Transfer</span>
                </button>
              </div>

              {/* 30-day Balance Chart */}
              <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-2">
                <div className="text-xs font-semibold text-[var(--mw-text-muted)]">
                  Grafik Saldo 30 Hari Terakhir
                </div>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedHistory} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <XAxis dataKey="label" hide />
                      <YAxis
                        tick={{ fill: 'var(--mw-text-dim)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${Math.round(v / 1000)}rb`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--mw-surface)',
                          border: '1px solid var(--mw-border)',
                          borderRadius: '10px',
                          fontSize: '12px',
                        }}
                        formatter={(v) => formatIDR(Number(v ?? 0), privacy)}
                      />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="#10b981"
                        fill="rgba(16, 185, 129, 0.18)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Investment Market Value Snapshot (Bibit) */}
              {selectedBalance.wallet.group === 'investment' && (
                <div className="p-4 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--mw-text)]">
                    <TrendingUp className="w-4 h-4 text-[var(--mw-primary)]" />
                    <span>Valuasi Nilai Pasar (Bibit)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[var(--mw-text-dim)]">Modal Disetor</div>
                      <div className="font-semibold tab-num text-[var(--mw-text)]">
                        {formatIDR(selectedBalance.costBasis, privacy)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--mw-text-dim)]">Untung/Rugi</div>
                      <div
                        className="font-semibold tab-num"
                        style={{
                          color:
                            selectedBalance.unrealizedGain >= 0
                              ? 'var(--mw-income)'
                              : 'var(--mw-expense)',
                        }}
                      >
                        {selectedBalance.unrealizedGain >= 0 ? '+' : ''}
                        {formatIDR(selectedBalance.unrealizedGain, privacy)}
                        {selectedBalance.unrealizedGainPct !== null
                          ? ` (${selectedBalance.unrealizedGainPct.toFixed(1).replace('.', ',')}%)`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={valuationInput}
                      onChange={(e) => setValuationInput(e.target.value)}
                      placeholder="Nilai portofolio saat ini (mis. 12,4jt)"
                      className="flex-1 px-3 py-2 rounded-xl text-xs bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                    />
                    <button
                      type="button"
                      onClick={handleUpdateValuation}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                      style={{ background: 'var(--mw-primary)' }}
                    >
                      Update
                    </button>
                  </div>
                </div>
              )}

              {/* Reconciliation */}
              <div className="p-4 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--mw-text)]">
                  <RefreshCw className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                  <span>Rekonsiliasi Saldo</span>
                </div>
                <p className="text-xs text-[var(--mw-text-muted)]">
                  Beda dengan aplikasi bank/e-wallet? Masukkan saldo sebenarnya untuk membuat koreksi otomatis.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={reconcileInput}
                    onChange={(e) => setReconcileInput(e.target.value)}
                    placeholder="Saldo sebenarnya (mis. 3,25jt)"
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleReconcile}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--mw-surface-3)] hover:bg-[var(--mw-primary)] hover:text-white text-[var(--mw-text)] cursor-pointer transition"
                  >
                    Sesuaikan
                  </button>
                </div>
              </div>

              {/* Mutations */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-[var(--mw-text-muted)]">
                  Mutasi Rekening ({selectedMutations.length})
                </h3>
                {selectedMutations.length === 0 ? (
                  <p className="text-xs text-[var(--mw-text-dim)] italic py-4">
                    Belum ada transaksi di dompet ini.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedMutations.map((tx) => {
                      const isIncoming =
                        tx.type === 'income' ||
                        (tx.type === 'adjustment' && tx.amount > 0) ||
                        tx.toWalletId === selectedBalance.wallet.id;
                      const delta = isIncoming
                        ? Math.abs(tx.amount)
                        : -(Math.abs(tx.amount) + (tx.walletId === selectedBalance.wallet.id ? tx.fee : 0));
                      const sub = tx.subcategoryId ? subById.get(tx.subcategoryId) : undefined;
                      const otherWalletId =
                        tx.walletId === selectedBalance.wallet.id ? tx.toWalletId : tx.walletId;
                      const otherWallet = otherWalletId ? walletById.get(otherWalletId) : undefined;
                      const label =
                        tx.type === 'transfer'
                          ? isIncoming
                            ? `Transfer dari ${otherWallet?.name ?? ''}`
                            : `Transfer ke ${otherWallet?.name ?? ''}`
                          : tx.type === 'adjustment'
                            ? 'Koreksi Saldo'
                            : sub?.name ?? tx.type;

                      return (
                        <div
                          key={tx.id}
                          className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--mw-text)] truncate">
                              {label}
                            </div>
                            <div className="text-[var(--mw-text-dim)] truncate">
                              {formatDateID(tx.date, today)}
                              {tx.note ? ` · ${tx.note}` : ''}
                            </div>
                          </div>
                          <div
                            className="font-bold tab-num shrink-0"
                            style={{ color: delta >= 0 ? 'var(--mw-income)' : 'var(--mw-expense)' }}
                          >
                            {delta >= 0 ? '+' : '−'}
                            {formatIDR(Math.abs(delta), privacy)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD WALLET MODAL */}
      {showAddWallet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <form
            onSubmit={handleAddWallet}
            className="w-full max-w-md mw-card rounded-3xl p-5 space-y-4 animate-sheet-up"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--mw-text)]">Tambah Wallet Baru</h2>
              <button
                type="button"
                onClick={() => setShowAddWallet(false)}
                className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Nama Wallet</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Mis. BCA, SeaBank, Flazz"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Grup</label>
                <select
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value as WalletGroup)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                >
                  {WALLET_GROUP_ORDER.map((g) => (
                    <option key={g} value={g}>
                      {WALLET_GROUP_LABELS[g]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Saldo Awal</label>
                <input
                  type="text"
                  value={newOpening}
                  onChange={(e) => setNewOpening(e.target.value)}
                  placeholder="0 (boleh ketik 500rb atau 2jt)"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddWallet(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'var(--mw-primary)' }}
              >
                Simpan Wallet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
