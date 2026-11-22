'use client';

import { useState } from 'react';
import { Calendar, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import {
  calculateGoalProgress,
  formatDateID,
  formatIDR,
  parseAmountExpression,
} from '@/lib/finance';
import type { Goal } from '@/types/finance';

export function GoalsView() {
  const { dataset, openQuickInput, addGoal, updateGoal, deleteGoal } = useWallet();
  const privacy = dataset.profile.privacyMode;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [name, setName] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [icon, setIcon] = useState('target');

  const openCreateModal = () => {
    setEditingGoal(null);
    setName('');
    setTargetStr('');
    setDeadline('');
    setIsShared(false);
    setIcon('target');
    setModalOpen(true);
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTargetStr(String(goal.targetAmount));
    setDeadline(goal.deadline ?? '');
    setIsShared(goal.isShared);
    setIcon(goal.icon);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetAmount = parseAmountExpression(targetStr).value;
    if (!name.trim() || targetAmount <= 0) return;

    if (editingGoal) {
      updateGoal({
        ...editingGoal,
        name: name.trim(),
        icon,
        targetAmount,
        deadline: deadline || null,
        color: isShared ? '#10b981' : '#38bdf8',
        isShared,
      });
    } else {
      addGoal({
        name: name.trim(),
        icon,
        targetAmount,
        deadline: deadline || null,
        walletId: dataset.wallets.find((w) => w.group === 'investment')?.id ?? null,
        subcategoryId:
          dataset.subcategories.find((s) => s.name === 'Umum' && s.categoryId === 'cat_sav_tabungan')
            ?.id ?? null,
        color: isShared ? '#10b981' : '#38bdf8',
        isShared,
      });
    }
    setModalOpen(false);
    setEditingGoal(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
            Target Tabungan (Goals)
          </h1>
          <p className="text-xs text-[var(--mw-text-muted)]">
            Pantau &amp; sesuaikan target tabungan pribadi maupun bersama pasangan
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
          style={{ background: 'var(--mw-primary)' }}
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Goal</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dataset.goals.map((g) => {
          const prog = calculateGoalProgress(g, dataset.transactions);
          return (
            <div key={g.id} className="mw-card rounded-3xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: `${g.color}22`, color: g.color }}
                    >
                      <DynamicIcon name={g.icon} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[var(--mw-text)] truncate">
                          {g.name}
                        </h2>
                        {g.isShared && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--mw-primary-soft)] text-[var(--mw-primary)]">
                            <Users className="w-3 h-3" />
                            Bersama
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--mw-text-muted)] mt-0.5 inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {g.deadline ? `Deadline ${formatDateID(g.deadline)}` : 'Tanpa deadline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-lg font-extrabold tab-num mr-1" style={{ color: g.color }}>
                      {prog.pct}%
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditModal(g)}
                      aria-label={`Edit goal ${g.name}`}
                      title="Edit target"
                      className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGoal(g.id)}
                      aria-label={`Hapus goal ${g.name}`}
                      title="Hapus target"
                      className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-dim)] hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="h-2.5 rounded-full bg-[var(--mw-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${prog.pct}%`, background: g.color }}
                    />
                  </div>
                  <div className="flex items-baseline justify-between text-xs tab-num">
                    <span className="font-bold text-[var(--mw-text)]">
                      {formatIDR(prog.saved, privacy)}
                    </span>
                    <span className="text-[var(--mw-text-muted)]">
                      Target {formatIDR(g.targetAmount, privacy)}
                    </span>
                  </div>
                </div>

                {/* Monthly Required */}
                <div className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex items-center justify-between text-xs">
                  <span className="text-[var(--mw-text-muted)]">
                    Sisa: <b className="tab-num text-[var(--mw-text)]">{formatIDR(prog.remaining, privacy)}</b>
                  </span>
                  {prog.requiredPerMonth !== null && prog.remaining > 0 && (
                    <span className="font-semibold tab-num text-[var(--mw-primary)]">
                      Butuh {formatIDR(prog.requiredPerMonth, privacy)}/bln
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  openQuickInput({
                    mode: 'create',
                    type: 'saving',
                    goalId: g.id,
                    subcategoryId: g.subcategoryId ?? undefined,
                    toWalletId: g.walletId ?? undefined,
                  })
                }
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[var(--mw-surface-2)] hover:bg-[var(--mw-primary)] hover:text-white text-[var(--mw-text)] border border-[var(--mw-border)] transition cursor-pointer"
              >
                + Tambah Dana ke {g.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Goal Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md mw-card rounded-3xl p-5 space-y-4 animate-sheet-up"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--mw-text)]">
                {editingGoal ? `Edit Target: ${editingGoal.name}` : 'Tambah Target Tabungan'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Nama Target</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mis. HP Baru, Sepatu Lari, Liburan Bali"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Target Nominal</label>
                <input
                  type="text"
                  required
                  value={targetStr}
                  onChange={(e) => setTargetStr(e.target.value)}
                  placeholder="Mis. 5jt atau 50jt"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">
                  Deadline (opsional)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Ikon</label>
                <div className="flex flex-wrap gap-1.5">
                  {['target', 'heart', 'shield', 'smartphone', 'shopping-bag', 'home', 'car'].map(
                    (ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setIcon(ic)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer"
                        style={{
                          background: icon === ic ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                          borderColor: icon === ic ? 'var(--mw-primary)' : 'var(--mw-border)',
                          color: icon === ic ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
                        }}
                      >
                        <DynamicIcon name={ic} className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span className="text-[var(--mw-text)]">
                  Tandai sebagai Goal Bersama pasangan (undangan pasangan aktif di Fase 2)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'var(--mw-primary)' }}
              >
                {editingGoal ? 'Simpan Perubahan' : 'Buat Target'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
