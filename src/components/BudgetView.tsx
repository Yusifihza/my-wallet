'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import {
  calculateCategoryBudgets,
  calculateZeroBasedAllocation,
  formatIDR,
  parseAmountExpression,
} from '@/lib/finance';

export function BudgetView() {
  const {
    dataset,
    periodLabel,
    periodTransactions,
    updateCategoryCap,
    updateSubcategoryBudget,
  } = useWallet();

  const privacy = dataset.profile.privacyMode;
  const [activeType, setActiveType] = useState<'income' | 'expense' | 'saving'>('expense');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [editingTarget, setEditingTarget] = useState<{
    kind: 'cat' | 'sub';
    id: string;
    value: string;
  } | null>(null);

  const allocation = useMemo(
    () => calculateZeroBasedAllocation(dataset.categories, dataset.subcategories),
    [dataset.categories, dataset.subcategories]
  );

  const budgetData = useMemo(
    () =>
      calculateCategoryBudgets(
        dataset.categories,
        dataset.subcategories,
        periodTransactions,
        activeType
      ),
    [activeType, dataset.categories, dataset.subcategories, periodTransactions]
  );

  const sortedItems = useMemo(() => {
    return [...budgetData.items].sort((a, b) => {
      if (a.pct !== null && b.pct !== null) return b.pct - a.pct;
      if (a.pct !== null) return -1;
      if (b.pct !== null) return 1;
      return b.actual - a.actual;
    });
  }, [budgetData.items]);

  const commitEdit = () => {
    if (!editingTarget) return;
    const raw = editingTarget.value.trim();
    const parsed = raw ? parseAmountExpression(raw).value : null;
    const finalVal = parsed && parsed > 0 ? parsed : null;
    if (editingTarget.kind === 'cat') {
      updateCategoryCap(editingTarget.id, finalVal);
    } else {
      updateSubcategoryBudget(editingTarget.id, finalVal);
    }
    setEditingTarget(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
            Budget Bulanan
          </h1>
          <p className="text-xs text-[var(--mw-text-muted)]">
            {periodLabel} · Interpretasi B (plafon kategori mengungguli jumlah sub-kategori)
          </p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveType('income')}
            className="px-3.5 py-1.5 rounded-lg cursor-pointer transition"
            style={{
              background: activeType === 'income' ? 'var(--mw-income-soft)' : 'transparent',
              color: activeType === 'income' ? 'var(--mw-income)' : 'var(--mw-text-muted)',
            }}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setActiveType('expense')}
            className="px-3.5 py-1.5 rounded-lg cursor-pointer transition"
            style={{
              background: activeType === 'expense' ? 'var(--mw-expense-soft)' : 'transparent',
              color: activeType === 'expense' ? 'var(--mw-expense)' : 'var(--mw-text-muted)',
            }}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setActiveType('saving')}
            className="px-3.5 py-1.5 rounded-lg cursor-pointer transition"
            style={{
              background: activeType === 'saving' ? 'var(--mw-saving-soft)' : 'transparent',
              color: activeType === 'saving' ? 'var(--mw-saving)' : 'var(--mw-text-muted)',
            }}
          >
            Saving
          </button>
        </div>
      </div>

      {/* Zero-Based Budget Helper (vertical stack on mobile, 4 columns on desktop) */}
      <div className="mw-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex items-center justify-between md:block gap-2">
            <div className="text-[var(--mw-text-muted)]">Target Income</div>
            <div className="text-sm sm:text-base font-bold tab-num md:mt-0.5" style={{ color: 'var(--mw-income)' }}>
              {formatIDR(allocation.incomeTarget, privacy)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex items-center justify-between md:block gap-2">
            <div className="text-[var(--mw-text-muted)]">Budget Expense</div>
            <div className="text-sm sm:text-base font-bold tab-num md:mt-0.5" style={{ color: 'var(--mw-expense)' }}>
              {formatIDR(allocation.expenseBudget, privacy)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex items-center justify-between md:block gap-2">
            <div className="text-[var(--mw-text-muted)]">Budget Saving</div>
            <div className="text-sm sm:text-base font-bold tab-num md:mt-0.5" style={{ color: 'var(--mw-saving)' }}>
              {formatIDR(allocation.savingBudget, privacy)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex items-center justify-between md:block gap-2">
            <div className="text-[var(--mw-text-muted)]">Sisa Dialokasikan</div>
            <div
              className="text-sm sm:text-base font-bold tab-num md:mt-0.5"
              style={{
                color:
                  allocation.unallocated < 0
                    ? 'var(--mw-expense)'
                    : allocation.unallocated === 0
                      ? 'var(--mw-income)'
                      : 'var(--mw-text)',
              }}
            >
              {formatIDR(allocation.unallocated, privacy)}
            </div>
          </div>
        </div>

        {allocation.unallocated < 0 && (
          <div
            className="p-3 rounded-xl text-xs flex items-center gap-2"
            style={{ background: 'var(--mw-warn-soft)', color: 'var(--mw-warn)' }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Total alokasi budget melebihi target pemasukan sebesar{' '}
              <b className="tab-num">{formatIDR(Math.abs(allocation.unallocated), privacy)}</b>. Klik ikon pensil di kategori untuk menyesuaikan.
            </span>
          </div>
        )}
      </div>

      {/* Category Budget Cards */}
      <div className="space-y-3">
        {sortedItems.map((item) => {
          const cat = item.category;
          const expanded = Boolean(expandedIds[cat.id]);
          const pct = item.pct ?? 0;
          const barColor =
            item.status === 'over'
              ? 'var(--mw-expense)'
              : item.status === 'warn'
                ? 'var(--mw-warn)'
                : item.status === 'safe'
                  ? 'var(--mw-primary)'
                  : 'var(--mw-text-dim)';

          const isEditingCap = editingTarget?.kind === 'cat' && editingTarget.id === cat.id;

          return (
            <div key={cat.id} className="mw-card rounded-2xl overflow-hidden">
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIds((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                    }
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-[var(--mw-text-dim)] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--mw-text-dim)] shrink-0" />
                    )}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${cat.color}22`, color: cat.color }}
                    >
                      <DynamicIcon name={cat.icon} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--mw-text)] truncate">
                        {cat.name}
                      </div>
                      <div className="text-xs text-[var(--mw-text-dim)]">
                        {cat.budgetCap !== null
                          ? `Plafon kategori: ${formatIDR(cat.budgetCap, privacy)}`
                          : item.effectiveBudget !== null
                            ? `Dari total sub-kategori`
                            : 'Track only (tanpa limit)'}
                      </div>
                    </div>
                  </button>

                  {/* Edit Category Cap */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isEditingCap ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          autoFocus
                          value={editingTarget.value}
                          onChange={(e) =>
                            setEditingTarget({ ...editingTarget, value: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit();
                            if (e.key === 'Escape') setEditingTarget(null);
                          }}
                          placeholder="Kosong = hapus plafon"
                          className="w-28 px-2 py-1 rounded-lg text-xs bg-[var(--mw-surface-2)] border border-[var(--mw-primary)] text-[var(--mw-text)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={commitEdit}
                          className="p-1.5 rounded-lg text-white cursor-pointer"
                          style={{ background: 'var(--mw-primary)' }}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-right">
                          <div className="text-xs font-bold tab-num text-[var(--mw-text)]">
                            {formatIDR(item.actual, privacy)}
                            {item.effectiveBudget !== null && (
                              <span className="font-normal text-[var(--mw-text-muted)]">
                                {' '}
                                / {formatIDR(item.effectiveBudget, privacy)}
                              </span>
                            )}
                          </div>
                          {item.pct !== null && (
                            <div className="text-xs font-semibold tab-num" style={{ color: barColor }}>
                              {item.pct}%
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          title="Ubah plafon kategori"
                          onClick={() =>
                            setEditingTarget({
                              kind: 'cat',
                              id: cat.id,
                              value: cat.budgetCap ? String(cat.budgetCap) : '',
                            })
                          }
                          className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {item.effectiveBudget !== null && (
                  <div className="h-2 rounded-full bg-[var(--mw-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
                    />
                  </div>
                )}

                {item.hasSubOverflow && (
                  <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--mw-warn)' }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Jumlah budget sub-kategori ({formatIDR(item.subBudgetSum, privacy)}) melebihi plafon kategori ({formatIDR(cat.budgetCap ?? 0, privacy)}).
                    </span>
                  </div>
                )}
              </div>

              {/* Expanded Sub-categories */}
              {expanded && (
                <div className="border-t border-[var(--mw-border)] bg-[var(--mw-surface-2)]/50 divide-y divide-[var(--mw-border)]">
                  {item.subStatuses.map(({ subcategory: sub, actual }) => {
                    const isEditingSub =
                      editingTarget?.kind === 'sub' && editingTarget.id === sub.id;
                    return (
                      <div
                        key={sub.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-[var(--mw-text)] font-medium">{sub.name}</span>
                        <div className="flex items-center gap-2">
                          {isEditingSub ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                autoFocus
                                value={editingTarget.value}
                                onChange={(e) =>
                                  setEditingTarget({ ...editingTarget, value: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit();
                                  if (e.key === 'Escape') setEditingTarget(null);
                                }}
                                placeholder="0 = Track only"
                                className="w-24 px-2 py-1 rounded-lg text-xs bg-[var(--mw-surface)] border border-[var(--mw-primary)] text-[var(--mw-text)] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={commitEdit}
                                className="p-1 rounded-lg text-white cursor-pointer"
                                style={{ background: 'var(--mw-primary)' }}
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="tab-num text-[var(--mw-text-muted)]">
                                {formatIDR(actual, privacy)} /{' '}
                                {sub.monthlyBudget
                                  ? formatIDR(sub.monthlyBudget, privacy)
                                  : 'Track only'}
                              </span>
                              <button
                                type="button"
                                title="Ubah budget sub-kategori"
                                onClick={() =>
                                  setEditingTarget({
                                    kind: 'sub',
                                    id: sub.id,
                                    value: sub.monthlyBudget ? String(sub.monthlyBudget) : '',
                                  })
                                }
                                className="p-1 rounded-lg hover:bg-[var(--mw-surface-3)] text-[var(--mw-text-dim)] hover:text-[var(--mw-text)] cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
