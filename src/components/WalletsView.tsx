'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import {
  buildBibitHistorySeries,
  buildWalletHistory30Days,
  formatDateID,
  formatIDR,
  formatIDRCompact,
  parseAmountExpression,
} from '@/lib/finance';
import {
  INVESTMENT_ASSET_COLORS,
  INVESTMENT_ASSET_LABELS,
  INVESTMENT_ASSET_ORDER,
  todayISO,
  WALLET_GROUP_LABELS,
  WALLET_GROUP_ORDER,
} from '@/lib/seed';
import type { InvestmentAssetClass, InvestmentProduct, WalletGroup } from '@/types/finance';

export function WalletsView() {
  const {
    dataset,
    nowDate,
    walletBalances,
    visibleWalletBalances,
    netWorth,
    openQuickInput,
    reconcileWallet,
    addValuation,
    addWallet,
    updateWallet,
    addInvestmentProduct,
    updateInvestmentProduct,
    updateProductMarketValue,
    deleteInvestmentProduct,
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

  // Bibit Multi-Product Portfolio state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InvestmentProduct | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodClass, setProdClass] = useState<InvestmentAssetClass>('sbn');
  const [prodGoalId, setProdGoalId] = useState<string>('');
  const [prodInvested, setProdInvested] = useState('');
  const [prodMarket, setProdMarket] = useState('');
  const [quickValProdId, setQuickValProdId] = useState<string | null>(null);
  const [quickValInput, setQuickValInput] = useState('');

  const bibitWallet = useMemo(
    () => dataset.wallets.find((w) => w.group === 'investment') ?? null,
    [dataset.wallets]
  );
  const bibitBalance = useMemo(
    () => (bibitWallet ? walletBalances.find((b) => b.wallet.id === bibitWallet.id) ?? null : null),
    [bibitWallet, walletBalances]
  );
  const bibitProducts = useMemo(
    () =>
      bibitWallet
        ? dataset.investmentProducts
            .filter((p) => p.walletId === bibitWallet.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [bibitWallet, dataset.investmentProducts]
  );
  const bibitHistory = useMemo(
    () =>
      bibitWallet
        ? buildBibitHistorySeries(
            bibitWallet,
            dataset.valuations,
            dataset.transactions,
            dataset.investmentProducts,
            nowDate
          )
        : [],
    [bibitWallet, dataset.investmentProducts, dataset.transactions, dataset.valuations, nowDate]
  );

  const selectedBalance = useMemo(
    () => walletBalances.find((b) => b.wallet.id === selectedWalletId) ?? null,
    [selectedWalletId, walletBalances]
  );

  const selectedHistory = useMemo(() => {
    if (!selectedBalance) return [];
    return buildWalletHistory30Days(selectedBalance.wallet, dataset.transactions, nowDate);
  }, [dataset.transactions, nowDate, selectedBalance]);

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

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdClass('sbn');
    setProdGoalId(dataset.goals.find((g) => g.isShared)?.id ?? '');
    setProdInvested('');
    setProdMarket('');
    setShowProductModal(true);
  };

  const openEditProduct = (prod: InvestmentProduct) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdClass(prod.assetClass);
    setProdGoalId(prod.goalId ?? '');
    setProdInvested(prod.investedAmount ? String(prod.investedAmount) : '');
    setProdMarket(prod.marketValue ? String(prod.marketValue) : '');
    setShowProductModal(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bibitWallet || !prodName.trim()) return;
    const inv = parseAmountExpression(prodInvested).value;
    const mkt = prodMarket.trim() ? parseAmountExpression(prodMarket).value : inv;
    if (editingProduct) {
      updateInvestmentProduct({
        ...editingProduct,
        name: prodName.trim(),
        assetClass: prodClass,
        goalId: prodGoalId || null,
        investedAmount: inv,
        marketValue: mkt,
        color: INVESTMENT_ASSET_COLORS[prodClass],
      });
    } else {
      addInvestmentProduct({
        walletId: bibitWallet.id,
        goalId: prodGoalId || null,
        name: prodName.trim(),
        assetClass: prodClass,
        investedAmount: inv,
        marketValue: mkt,
        color: INVESTMENT_ASSET_COLORS[prodClass],
      });
    }
    setShowProductModal(false);
    setEditingProduct(null);
  };

  const handleQuickMarketSave = (prodId: string) => {
    const val = parseAmountExpression(quickValInput).value;
    if (val < 0) return;
    updateProductMarketValue(prodId, val);
    setQuickValProdId(null);
    setQuickValInput('');
  };

  const bibitTotalMarket = bibitProducts.reduce((s, p) => s + p.marketValue, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
            Dompet &amp; Portofolio Bibit
          </h1>
          <p className="text-xs text-[var(--mw-text-muted)]">
            Saldo otomatis tiap dompet serta nilai pasar multi-produk Bibit (PU, Obligasi, Reksa Saham, Saham, SBN)
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
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--mw-text-muted)]">Nilai Pasar Bibit</span>
            {bibitBalance && bibitBalance.unrealizedGainPct !== null && (
              <span
                className="text-xs font-bold tab-num px-2 py-0.5 rounded-full"
                style={{
                  background:
                    bibitBalance.unrealizedGain >= 0
                      ? 'var(--mw-income-soft)'
                      : 'var(--mw-expense-soft)',
                  color:
                    bibitBalance.unrealizedGain >= 0
                      ? 'var(--mw-income)'
                      : 'var(--mw-expense)',
                }}
              >
                {bibitBalance.unrealizedGain >= 0 ? '+' : ''}
                {bibitBalance.unrealizedGainPct.toFixed(2).replace('.', ',')}%
              </span>
            )}
          </div>
          <div className="text-xl font-bold tab-num text-[var(--mw-primary)] mt-1">
            {formatIDR(netWorth.investment, privacy)}
          </div>
        </div>
      </div>

      {/* Dedicated Bibit Multi-Product Portfolio & Market Valuation Panel */}
      {bibitWallet && bibitBalance && (
        <section className="mw-card rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--mw-primary)]" />
                <h2 className="text-base font-bold text-[var(--mw-text)]">
                  Portofolio &amp; Nilai Pasar Bibit ({bibitProducts.length} Produk)
                </h2>
              </div>
              <p className="text-xs text-[var(--mw-text-muted)]">
                Catat modal setor &amp; update nilai pasar per produk (PU, Obligasi, Reksa Saham, Saham, SBN, atau produk baru)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCreateProduct}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                style={{ background: 'var(--mw-primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Produk</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedWalletId(bibitWallet.id)}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] cursor-pointer"
              >
                Mutasi Bibit
              </button>
            </div>
          </div>

          {/* Bibit Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
              <div className="text-[var(--mw-text-muted)]">Total Modal Disetor</div>
              <div className="text-base font-bold tab-num text-[var(--mw-text)] mt-0.5">
                {formatIDR(bibitBalance.costBasis, privacy)}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
              <div className="text-[var(--mw-text-muted)]">Total Nilai Pasar</div>
              <div className="text-base font-bold tab-num text-[var(--mw-primary)] mt-0.5">
                {formatIDR(bibitBalance.balance, privacy)}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
              <div className="text-[var(--mw-text-muted)]">Total Untung / Rugi</div>
              <div
                className="text-base font-bold tab-num mt-0.5"
                style={{
                  color:
                    bibitBalance.unrealizedGain >= 0 ? 'var(--mw-income)' : 'var(--mw-expense)',
                }}
              >
                {bibitBalance.unrealizedGain >= 0 ? '+' : ''}
                {formatIDR(bibitBalance.unrealizedGain, privacy)}
                {bibitBalance.unrealizedGainPct !== null
                  ? ` (${bibitBalance.unrealizedGain >= 0 ? '+' : ''}${bibitBalance.unrealizedGainPct.toFixed(2).replace('.', ',')}%)`
                  : ''}
              </div>
            </div>
          </div>

          {/* Allocation Stacked Bar */}
          {bibitTotalMarket > 0 && (
            <div className="space-y-1.5">
              <div className="h-3 rounded-full overflow-hidden flex bg-[var(--mw-surface-2)]">
                {bibitProducts
                  .filter((p) => p.marketValue > 0)
                  .map((p) => (
                    <div
                      key={p.id}
                      style={{
                        width: `${(p.marketValue / bibitTotalMarket) * 100}%`,
                        background: p.color,
                      }}
                      title={`${p.name}: ${Math.round((p.marketValue / bibitTotalMarket) * 100)}%`}
                    />
                  ))}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-[var(--mw-text-muted)]">
                {bibitProducts
                  .filter((p) => p.marketValue > 0)
                  .map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: p.color }}
                      />
                      <span>
                        {p.name}{' '}
                        <b className="tab-num text-[var(--mw-text)]">
                          {Math.round((p.marketValue / bibitTotalMarket) * 100)}%
                        </b>
                      </span>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Chart: Modal Disetor vs Nilai Pasar */}
          {bibitHistory.length >= 2 && (
            <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-2">
              <div className="text-xs font-semibold text-[var(--mw-text-muted)]">
                Grafik Modal Disetor vs Nilai Pasar Bibit
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bibitHistory} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
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
                      formatter={(val, name) => [
                        formatIDR(Number(val ?? 0), privacy),
                        name === 'marketValue' ? 'Nilai Pasar' : 'Modal Disetor',
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px' }}
                      formatter={(v) => (v === 'marketValue' ? 'Nilai Pasar' : 'Modal Disetor')}
                    />
                    <Line
                      type="monotone"
                      dataKey="invested"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="marketValue"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3.5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Product Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {bibitProducts.map((p) => {
              const gain = p.marketValue - p.investedAmount;
              const retPct =
                p.investedAmount > 0 ? (gain / p.investedAmount) * 100 : null;
              const goal = p.goalId ? dataset.goals.find((g) => g.id === p.goalId) : null;
              const isQuickUpdating = quickValProdId === p.id;

              return (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: p.color }}
                        />
                        <span className="text-sm font-bold text-[var(--mw-text)] truncate">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mw-surface)] text-[var(--mw-text-muted)]">
                          {INVESTMENT_ASSET_LABELS[p.assetClass]}
                        </span>
                        {goal && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mw-primary-soft)] text-[var(--mw-primary)] font-medium">
                            🎯 {goal.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditProduct(p)}
                        title="Edit produk"
                        className="p-1 rounded-lg bg-[var(--mw-surface)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteInvestmentProduct(p.id)}
                        title="Hapus produk"
                        className="p-1 rounded-lg bg-[var(--mw-surface)] text-[var(--mw-text-dim)] hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <div className="text-[11px] text-[var(--mw-text-dim)]">Modal Setor</div>
                      <div className="font-semibold tab-num text-[var(--mw-text)]">
                        {formatIDR(p.investedAmount, privacy)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-[var(--mw-text-dim)]">Nilai Pasar</div>
                      <div className="font-bold tab-num text-[var(--mw-text)]">
                        {formatIDR(p.marketValue, privacy)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-[var(--mw-border)]">
                    <span
                      className="font-semibold tab-num"
                      style={{
                        color: gain >= 0 ? 'var(--mw-income)' : 'var(--mw-expense)',
                      }}
                    >
                      {gain >= 0 ? '+' : ''}
                      {formatIDR(gain, privacy)}
                      {retPct !== null
                        ? ` (${gain >= 0 ? '+' : ''}${retPct.toFixed(2).replace('.', ',')}%)`
                        : ''}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setQuickValProdId(isQuickUpdating ? null : p.id);
                        setQuickValInput(p.marketValue ? String(p.marketValue) : '');
                      }}
                      className="px-2 py-1 rounded-lg bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-primary)] font-semibold cursor-pointer"
                    >
                      Update Pasar
                    </button>
                  </div>

                  {isQuickUpdating && (
                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="text"
                        autoFocus
                        value={quickValInput}
                        onChange={(e) => setQuickValInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickMarketSave(p.id);
                        }}
                        placeholder="Nilai pasar (mis. 4,5jt)"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[var(--mw-surface)] border border-[var(--mw-primary)] text-[var(--mw-text)] tab-num focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickMarketSave(p.id)}
                        className="px-2.5 py-1.5 rounded-lg text-white font-semibold cursor-pointer"
                        style={{ background: 'var(--mw-primary)' }}
                      >
                        Simpan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

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

      {/* Add / Edit Bibit Investment Product Modal */}
      {showProductModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <form
            onSubmit={handleProductSubmit}
            className="w-full max-w-md mw-card rounded-3xl p-5 space-y-4 animate-sheet-up"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--mw-text)]">
                {editingProduct ? `Edit Produk: ${editingProduct.name}` : 'Tambah Produk Bibit Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Nama Produk</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="Mis. SBN ORI027, Sucorinvest PU, BBCA"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[var(--mw-text-muted)] mb-1">Jenis Instrumen</label>
                  <select
                    value={prodClass}
                    onChange={(e) => setProdClass(e.target.value as InvestmentAssetClass)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                  >
                    {INVESTMENT_ASSET_ORDER.map((cls) => (
                      <option key={cls} value={cls}>
                        {INVESTMENT_ASSET_LABELS[cls]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--mw-text-muted)] mb-1">Hubungkan ke Goal</label>
                  <select
                    value={prodGoalId}
                    onChange={(e) => setProdGoalId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                  >
                    <option value="">Pribadi (Tanpa Goal)</option>
                    {dataset.goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                        {g.sharedRole === 'member'
                          ? ` (Bersama · Milik ${g.ownerName || 'Pasangan'})`
                          : g.isShared
                            ? ' (Bersama)'
                            : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[var(--mw-text-muted)] mb-1">Modal Disetor</label>
                  <input
                    type="text"
                    value={prodInvested}
                    onChange={(e) => setProdInvested(e.target.value)}
                    placeholder="Mis. 2jt"
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--mw-text-muted)] mb-1">Nilai Pasar Saat Ini</label>
                  <input
                    type="text"
                    value={prodMarket}
                    onChange={(e) => setProdMarket(e.target.value)}
                    placeholder="Kosong = sama modal"
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'var(--mw-primary)' }}
              >
                {editingProduct ? 'Simpan Perubahan' : 'Simpan Produk'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
