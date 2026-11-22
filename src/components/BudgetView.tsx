'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import {
  calculateCategoryBudgets,
  calculateZeroBasedAllocation,
  formatIDR,
  parseAmountExpression,
} from '@/lib/finance';
import type { CategoryType } from '@/types/finance';

const CATEGORY_ICONS = [
  'tag',
  'utensils',
  'car',
  'shopping-bag',
  'receipt',
  'gamepad-2',
  'heart-pulse',
  'home',
  'gift',
  'book-open',
  'piggy-bank',
  'wallet',
  'sparkles',
  'package',
];

export function BudgetView() {
  const {
    dataset,
    periodLabel,
    periodTransactions,
    addCategory,
    updateCategoryCap,
    updateSubcategoryBudget,
    addSubcategory,
  } = useWallet();

  const privacy = dataset.profile.privacyMode;
  const [activeType, setActiveType] = useState<CategoryType>('expense');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [editingTarget, setEditingTarget] = useState<{
    kind: 'cat' | 'sub';
    id: string;
    value: string;
  } | null>(null);

  // Add Category Modal
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCap, setNewCatCap] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('tag');

  // Add Sub-Category Modal
  const [addSubCatId, setAddSubCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubBudget, setNewSubBudget] = useState('');
  const [newSubAliases, setNewSubAliases] = useState('');

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

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const capVal = newCatCap.trim() ? parseAmountExpression(newCatCap).value : null;
    const colorByType: Record<CategoryType, string> = {
      income: '#10b981',
      expense: '#f97316',
      saving: '#38bdf8',
    };
    addCategory(
      activeType,
      newCatName.trim(),
      capVal && capVal > 0 ? capVal : null,
      newCatIcon,
      colorByType[activeType]
    );
    setNewCatName('');
    setNewCatCap('');
    setNewCatIcon('tag');
    setShowAddCat(false);
  };

  const handleAddSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSubCatId || !newSubName.trim()) return;
    const budVal = newSubBudget.trim() ? parseAmountExpression(newSubBudget).value : null;
    const aliases = newSubAliases
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    addSubcategory(addSubCatId, newSubName.trim(), budVal && budVal > 0 ? budVal : null, aliases);
    setExpandedIds((prev) => ({ ...prev, [addSubCatId]: true }));
    setNewSubName('');
    setNewSubBudget('');
    setNewSubAliases('');
    setAddSubCatId(null);
  };

  const addSubParent = addSubCatId
    ? dataset.categories.find((c) => c.id === addSubCatId)
    : null;

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

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveType('income')}
              className="px-3 py-1.5 rounded-lg cursor-pointer transition"
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
              className="px-3 py-1.5 rounded-lg cursor-pointer transition"
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
              className="px-3 py-1.5 rounded-lg cursor-pointer transition"
              style={{
                background: activeType === 'saving' ? 'var(--mw-saving-soft)' : 'transparent',
                color: activeType === 'saving' ? 'var(--mw-saving)' : 'var(--mw-text-muted)',
              }}
            >
              Saving
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddCat(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ background: 'var(--mw-primary)' }}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Kategori</span>
          </button>
        </div>
      </div>

      {/* Zero-Based Budget Helper (vertical stack on mobile, 4 columns on desktop) */}
      <div className="mw-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex items-center justify-between md:block gap-2">
            <div className="text-[var(--mw-text-muted)]">Target Income</div>
            <div
              className="text-sm sm:text-base font-bold tab-num md:mt-0.5"
              style={{ color: 'var(--mw-income)' }}
            >
              {formatIDR(allocation.incomeTarget, privacy)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex items-center justify-between md:block gap-2">
            <div className="text-[var(--mw-text-muted)]">Budget Expense</div>
            <div
              className="text-sm sm:text-base font-bold tab-num md:mt-0.5"
              style={{ color: 'var(--mw-expense)' }}
            >
              {formatIDR(allocation.expenseBudget, privacy)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex items-center justify-between md:block gap-2">
            <div className="text-[var(--mw-text-muted)]">Budget Saving</div>
            <div
              className="text-sm sm:text-base font-bold tab-num md:mt-0.5"
              style={{ color: 'var(--mw-saving)' }}
            >
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
              <b className="tab-num">{formatIDR(Math.abs(allocation.unallocated), privacy)}</b>. Klik tab <b>Income</b> atau ikon pensil di kategori untuk menyesuaikan.
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
                          placeholder="Kosong = hapus"
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

              {/* Expanded Sub-categories + Add Sub-category button */}
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

                  <div className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAddSubCatId(cat.id);
                        setNewSubName('');
                        setNewSubBudget('');
                        setNewSubAliases('');
                      }}
                      className="text-xs font-semibold text-[var(--mw-primary)] inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Sub-Kategori di {cat.name}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ADD CATEGORY MODAL */}
      {showAddCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <form
            onSubmit={handleAddCategory}
            className="w-full max-w-md mw-card rounded-3xl p-5 space-y-4 animate-sheet-up"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--mw-text)]">
                Tambah Kategori ({activeType.toUpperCase()})
              </h2>
              <button
                type="button"
                onClick={() => setShowAddCat(false)}
                className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Nama Kategori</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Mis. Side Hustle, Hobi Olahraga, Dana Liburan"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">
                  Plafon / Target Bulanan (opsional)
                </label>
                <input
                  type="text"
                  value={newCatCap}
                  onChange={(e) => setNewCatCap(e.target.value)}
                  placeholder="Kosong = ikut total sub-kategori / Track only (mis. 300rb)"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Ikon</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewCatIcon(ic)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer"
                      style={{
                        background:
                          newCatIcon === ic ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                        borderColor:
                          newCatIcon === ic ? 'var(--mw-primary)' : 'var(--mw-border)',
                        color:
                          newCatIcon === ic ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
                      }}
                    >
                      <DynamicIcon name={ic} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[var(--mw-text-dim)]">
                Sub-kategori <b>Umum</b> akan dibuat otomatis di dalam kategori baru ini.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCat(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'var(--mw-primary)' }}
              >
                Simpan Kategori
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD SUB-CATEGORY MODAL */}
      {addSubParent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <form
            onSubmit={handleAddSubcategory}
            className="w-full max-w-md mw-card rounded-3xl p-5 space-y-4 animate-sheet-up"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--mw-text)]">
                Tambah Sub-Kategori di {addSubParent.name}
              </h2>
              <button
                type="button"
                onClick={() => setAddSubCatId(null)}
                className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Nama Sub-Kategori</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="Mis. Kopi Spesialti, Padel, Bonus Proyek"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">
                  Budget / Target Bulanan (opsional)
                </label>
                <input
                  type="text"
                  value={newSubBudget}
                  onChange={(e) => setNewSubBudget(e.target.value)}
                  placeholder="Kosong = Track only (mis. 150rb)"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">
                  Alias Pencarian (pisah koma, opsional)
                </label>
                <input
                  type="text"
                  value={newSubAliases}
                  onChange={(e) => setNewSubAliases(e.target.value)}
                  placeholder="Mis. matcha, latte, cafe"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddSubCatId(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'var(--mw-primary)' }}
              >
                Simpan Sub-Kategori
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
