'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Plus, Sparkles, X } from 'lucide-react';
import { DynamicIcon } from '@/components/IconMap';
import { WalletLogo } from '@/components/WalletLogo';
import { useWallet } from '@/context/WalletContext';
import { calculateZeroBasedAllocation, formatIDR, parseAmountExpression } from '@/lib/finance';
import { todayISO, WALLET_GROUP_LABELS, WALLET_GROUP_ORDER } from '@/lib/seed';
import type { Wallet, WalletGroup } from '@/types/finance';

export function OnboardingWizard() {
  const {
    dataset,
    addWallet,
    updateOpeningBalances,
    updateSubcategoryBudget,
    setDisplayName,
    completeOnboarding,
  } = useWallet();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(dataset.profile.displayName || 'Kamu');
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletGroup, setNewWalletGroup] = useState<WalletGroup>('bank');
  const [newWalletOpening, setNewWalletOpening] = useState('');

  const gajiSub = useMemo(
    () =>
      dataset.subcategories.find((s) => s.name === 'Gaji') ??
      dataset.subcategories.find((s) => {
        const c = dataset.categories.find((cat) => cat.id === s.categoryId);
        return c?.type === 'income';
      }),
    [dataset.categories, dataset.subcategories]
  );
  const [incomeTargetInput, setIncomeTargetInput] = useState<string>(() =>
    gajiSub?.monthlyBudget ? String(gajiSub.monthlyBudget) : '6000000'
  );
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    dataset.wallets
      .filter((w) => !w.hidden && !w.archived)
      .forEach((w) => {
        map[w.id] = w.openingBalance > 0 ? String(w.openingBalance) : '';
      });
    return map;
  });

  const activeWallets = useMemo(
    () => dataset.wallets.filter((w) => !w.hidden && !w.archived),
    [dataset.wallets]
  );

  const getWalletInputValue = (w: Wallet) =>
    inputs[w.id] !== undefined
      ? inputs[w.id]
      : w.openingBalance > 0
        ? String(w.openingBalance)
        : '';

  const totalOpening = useMemo(() => {
    return activeWallets.reduce((sum, w) => {
      const raw =
        inputs[w.id] !== undefined
          ? inputs[w.id]
          : w.openingBalance > 0
            ? String(w.openingBalance)
            : '';
      const parsed = parseAmountExpression(raw);
      return sum + parsed.value;
    }, 0);
  }, [activeWallets, inputs]);

  const allocation = useMemo(
    () => calculateZeroBasedAllocation(dataset.categories, dataset.subcategories),
    [dataset.categories, dataset.subcategories]
  );

  const handleIncomeTargetChange = (raw: string) => {
    setIncomeTargetInput(raw);
    if (!gajiSub) return;
    const val = parseAmountExpression(raw).value;
    updateSubcategoryBudget(gajiSub.id, val > 0 ? val : null);
  };

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
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
      name: newWalletName.trim(),
      group: newWalletGroup,
      kind: newWalletGroup === 'credit' ? 'liability' : 'asset',
      openingBalance: parseAmountExpression(newWalletOpening).value,
      openingDate: todayISO(),
      icon: iconByGroup[newWalletGroup],
      color: colorByGroup[newWalletGroup],
      includeInTotal: true,
      hidden: false,
      archived: false,
    });
    setNewWalletName('');
    setNewWalletOpening('');
    setShowAddWallet(false);
  };

  const handleStep1Next = () => {
    if (name.trim()) setDisplayName(name.trim());
    const numericMap: Record<string, number> = {};
    activeWallets.forEach((w) => {
      numericMap[w.id] = parseAmountExpression(getWalletInputValue(w)).value;
    });
    updateOpeningBalances(numericMap);
    setStep(2);
  };

  const fillQuickSample = () => {
    const sampleByName: Record<string, string> = {
      Tunai: '320rb',
      Jago: '3,2jt',
      Krom: '1,5jt',
      BNI: '900rb',
      Mandiri: '1,1jt',
      GoPay: '450rb',
      ShopeePay: '200rb',
      DANA: '150rb',
      LinkAja: '50rb',
      OVO: '90rb',
      'Mandiri e-money': '140rb',
      Bibit: '10jt',
    };
    setInputs((prev) => {
      const next = { ...prev };
      activeWallets.forEach((w) => {
        if (sampleByName[w.name]) next[w.id] = sampleByName[w.name];
      });
      return next;
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--mw-bg)]">
      <div className="w-full max-w-2xl mw-card rounded-3xl p-5 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <WalletLogo size="md" />
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--mw-text-muted)]">
            <span
              className="px-2.5 py-1 rounded-full"
              style={{
                background: step === 1 ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                color: step === 1 ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
              }}
            >
              1. Saldo Awal
            </span>
            <span
              className="px-2.5 py-1 rounded-full"
              style={{
                background: step === 2 ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                color: step === 2 ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
              }}
            >
              2. Cek Budget
            </span>
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
                  Atur saldo awal dompetmu ({activeWallets.length})
                </h1>
                <p className="text-xs sm:text-sm text-[var(--mw-text-muted)]">
                  Mulai dari 0 dan isi saldo saat ini (boleh ketik <code className="font-mono text-[var(--mw-primary)]">350rb</code> atau <code className="font-mono text-[var(--mw-primary)]">2,5jt</code>). Bisa diubah kapan saja nanti.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddWallet((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer transition"
                  style={{ background: 'var(--mw-primary)' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Wallet
                </button>
                <button
                  type="button"
                  onClick={fillQuickSample}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] text-[var(--mw-text-muted)] cursor-pointer transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                  Isi contoh angka
                </button>
              </div>
            </div>

            {showAddWallet && (
              <form
                onSubmit={handleAddWallet}
                className="p-4 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-primary)] space-y-3 text-xs animate-sheet-up"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--mw-text)]">Tambah Wallet Baru</span>
                  <button
                    type="button"
                    onClick={() => setShowAddWallet(false)}
                    className="p-1 rounded-lg text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newWalletName}
                    onChange={(e) => setNewWalletName(e.target.value)}
                    placeholder="Nama (mis. BCA, SeaBank)"
                    className="px-3 py-2 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                  />
                  <select
                    value={newWalletGroup}
                    onChange={(e) => setNewWalletGroup(e.target.value as WalletGroup)}
                    className="px-3 py-2 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                  >
                    {WALLET_GROUP_ORDER.map((g) => (
                      <option key={g} value={g}>
                        {WALLET_GROUP_LABELS[g]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newWalletOpening}
                    onChange={(e) => setNewWalletOpening(e.target.value)}
                    placeholder="Saldo awal (mis. 500rb)"
                    className="px-3 py-2 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddWallet(false)}
                    className="px-3 py-1.5 rounded-xl bg-[var(--mw-surface)] text-[var(--mw-text-muted)] cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl font-semibold text-white cursor-pointer"
                    style={{ background: 'var(--mw-primary)' }}
                  >
                    Simpan Wallet
                  </button>
                </div>
              </form>
            )}

            <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="text-xs font-medium text-[var(--mw-text-muted)] shrink-0" htmlFor="onb-name">
                Nama panggilan
              </label>
              <input
                id="onb-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Namamu"
                className="w-full sm:w-64 px-3 py-2 rounded-xl text-sm bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
              />
            </div>

            <div className="max-h-[46vh] overflow-y-auto mw-scroll pr-1 space-y-4">
              {WALLET_GROUP_ORDER.map((grp) => {
                const list = activeWallets.filter((w) => w.group === grp);
                if (list.length === 0) return null;
                return (
                  <div key={grp} className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--mw-text-dim)] px-1">
                      {WALLET_GROUP_LABELS[grp]}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {list.map((w) => {
                        const rawVal = getWalletInputValue(w);
                        const parsed = parseAmountExpression(rawVal);
                        return (
                          <div
                            key={w.id}
                            className="p-3 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] flex items-center gap-3"
                          >
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: `${w.color}22`, color: w.color }}
                            >
                              <DynamicIcon name={w.icon} className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-[var(--mw-text)] truncate">
                                {w.name}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-xs text-[var(--mw-text-dim)]">Rp</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={rawVal}
                                  onChange={(e) =>
                                    setInputs((prev) => ({ ...prev, [w.id]: e.target.value }))
                                  }
                                  placeholder="0"
                                  className="w-full bg-transparent text-sm font-semibold tab-num text-[var(--mw-text)] focus:outline-none"
                                />
                              </div>
                              {rawVal && /[a-z,+-]/i.test(rawVal) && (
                                <div className="text-xs text-[var(--mw-primary)] tab-num">
                                  = {formatIDR(parsed.value)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[var(--mw-border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--mw-text-muted)]">Total Saldo Awal</div>
                <div className="text-lg font-bold tab-num text-[var(--mw-primary)]">
                  {formatIDR(totalOpening)}
                </div>
              </div>
              <button
                type="button"
                onClick={handleStep1Next}
                className="px-5 py-3 rounded-2xl text-sm font-semibold text-white inline-flex items-center gap-2 cursor-pointer transition"
                style={{ background: 'var(--mw-primary)' }}
              >
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
                Ringkasan struktur budget awalmu
              </h1>
              <p className="text-xs sm:text-sm text-[var(--mw-text-muted)]">
                Sesuaikan target income bulananmu di bawah ini. Seluruh kategori &amp; sub-kategori juga bisa diedit di menu <b>Budget</b>.
              </p>
            </div>

            {/* Editable Income Target */}
            <div className="p-4 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-1.5">
              <label
                htmlFor="onb-income-target"
                className="text-xs font-semibold text-[var(--mw-text-muted)] block"
              >
                Atur Target Income Bulanan (Gaji)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--mw-text-dim)]">Rp</span>
                <input
                  id="onb-income-target"
                  type="text"
                  value={incomeTargetInput}
                  onChange={(e) => handleIncomeTargetChange(e.target.value)}
                  placeholder="Mis. 5jt atau 4.500.000"
                  className="w-full bg-transparent text-lg font-bold tab-num text-[var(--mw-income)] focus:outline-none"
                />
              </div>
              <div className="text-xs text-[var(--mw-text-dim)]">
                Boleh ketik singkat seperti <code className="font-mono text-[var(--mw-primary)]">5jt</code> atau <code className="font-mono text-[var(--mw-primary)]">4,5jt</code>
              </div>
            </div>

            {/* 4 Allocation Cards — Vertical Stack on Mobile, 2x2 / 4 cols on Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] flex items-center justify-between md:block gap-2">
                <div className="text-[var(--mw-text-muted)]">Target Income</div>
                <div className="text-sm sm:text-base font-bold tab-num md:mt-1" style={{ color: 'var(--mw-income)' }}>
                  {formatIDR(allocation.incomeTarget)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] flex items-center justify-between md:block gap-2">
                <div className="text-[var(--mw-text-muted)]">Budget Expense</div>
                <div className="text-sm sm:text-base font-bold tab-num md:mt-1" style={{ color: 'var(--mw-expense)' }}>
                  {formatIDR(allocation.expenseBudget)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] flex items-center justify-between md:block gap-2">
                <div className="text-[var(--mw-text-muted)]">Budget Saving</div>
                <div className="text-sm sm:text-base font-bold tab-num md:mt-1" style={{ color: 'var(--mw-saving)' }}>
                  {formatIDR(allocation.savingBudget)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] flex items-center justify-between md:block gap-2">
                <div className="text-[var(--mw-text-muted)]">Sisa Alokasi</div>
                <div
                  className="text-sm sm:text-base font-bold tab-num md:mt-1"
                  style={{
                    color:
                      allocation.unallocated < 0
                        ? 'var(--mw-expense)'
                        : 'var(--mw-income)',
                  }}
                >
                  {formatIDR(allocation.unallocated)}
                </div>
              </div>
            </div>

            {allocation.unallocated < 0 && (
              <div
                className="p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed"
                style={{
                  background: 'var(--mw-warn-soft)',
                  borderColor: 'rgba(251, 191, 36, 0.35)',
                  color: 'var(--mw-text)',
                }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--mw-warn)' }} />
                <div>
                  <div className="font-semibold">
                    Alokasi budget melebihi target income sebesar{' '}
                    <span className="tab-num" style={{ color: 'var(--mw-warn)' }}>
                      {formatIDR(Math.abs(allocation.unallocated))}
                    </span>
                  </div>
                  <p className="text-[var(--mw-text-muted)] mt-1">
                    Tidak masalah untuk mulai dulu—kamu bisa menyesuaikan plafon kategori kapan saja di menu <b>Budget</b>.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--mw-border)] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-2xl text-sm font-medium bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] text-[var(--mw-text)] inline-flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="button"
                onClick={completeOnboarding}
                className="px-6 py-3 rounded-2xl text-sm font-semibold text-white inline-flex items-center gap-2 cursor-pointer transition"
                style={{ background: 'var(--mw-primary)' }}
              >
                <Check className="w-4 h-4" />
                <span>Masuk ke My Wallet</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
