'use client';

import { useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { DynamicIcon } from '@/components/IconMap';
import { useWallet } from '@/context/WalletContext';
import {
  calculateGoalProgress,
  formatDateID,
  formatIDR,
  generateInviteCode,
  parseAmountExpression,
} from '@/lib/finance';
import { todayISO } from '@/lib/seed';
import type { Goal } from '@/types/finance';

export function GoalsView() {
  const {
    dataset,
    nowDate,
    authMode,
    syncingCloud,
    refreshCloudData,
    openQuickInput,
    addGoal,
    updateGoal,
    deleteGoal,
    joinSharedGoal,
    leaveSharedGoal,
    addGoalContribution,
    deleteGoalContribution,
    saveGoalInvite,
  } = useWallet();
  const privacy = dataset.profile.privacyMode;

  // Create / Edit Goal modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [name, setName] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [icon, setIcon] = useState('target');

  // Partner / Manual Contribution modal
  const [contribGoal, setContribGoal] = useState<Goal | null>(null);
  const [contribIsSelfMember, setContribIsSelfMember] = useState(false);
  const [partnerName, setPartnerName] = useState('Pasangan');
  const [contribAmt, setContribAmt] = useState('');
  const [contribDate, setContribDate] = useState('');
  const [contribProduct, setContribProduct] = useState('Pasar Uang (PU)');
  const [contribNote, setContribNote] = useState('');

  // Invite Partner modal
  const [inviteGoal, setInviteGoal] = useState<Goal | null>(null);
  const [invCode, setInvCode] = useState('');
  const [invPartnerName, setInvPartnerName] = useState('Pasangan');
  const [invPartnerEmail, setInvPartnerEmail] = useState('');
  const [invShare, setInvShare] = useState('50');
  const [copiedCode, setCopiedCode] = useState(false);

  // Join Shared Goal modal (Partner phone)
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

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

  const openInviteModal = (goal: Goal) => {
    const existing = dataset.goalInvites.find((i) => i.goalId === goal.id);
    const sharedPeer = dataset.sharedGoalPeers?.[goal.id];
    const needsFreshCode =
      !existing || !existing.code.trim() || existing.code.trim().toUpperCase() === 'MW-WED-2027';
    const resolvedCode = needsFreshCode ? generateInviteCode() : existing.code.trim().toUpperCase();
    const resolvedPartnerName =
      sharedPeer?.memberName || existing?.partnerName || 'Pasangan';
    const resolvedShare = existing?.sharePercent ?? sharedPeer?.sharePercent ?? 50;
    const resolvedStatus: 'pending' | 'joined' =
      sharedPeer?.memberId || existing?.status === 'joined' ? 'joined' : 'pending';

    // Immediately persist a live unique invite code so copying & sending via WA works right away
    if (needsFreshCode) {
      saveGoalInvite(
        {
          goalId: goal.id,
          code: resolvedCode,
          partnerName: resolvedPartnerName,
          partnerEmail: existing?.partnerEmail || '',
          sharePercent: resolvedShare,
          status: resolvedStatus,
        },
        { silent: true }
      );
    }

    setInviteGoal(goal);
    setInvCode(resolvedCode);
    setInvPartnerName(resolvedPartnerName);
    setInvPartnerEmail(existing?.partnerEmail || '');
    setInvShare(String(resolvedShare));
    setCopiedCode(false);
  };

  const openContribModal = (goal: Goal, asSelfMember = false) => {
    const existing = dataset.goalInvites.find((i) => i.goalId === goal.id);
    const sharedPeer = dataset.sharedGoalPeers?.[goal.id];
    setContribGoal(goal);
    setContribIsSelfMember(asSelfMember);
    setPartnerName(
      asSelfMember
        ? dataset.profile.displayName || 'Aku'
        : sharedPeer?.memberName || existing?.partnerName || 'Pasangan'
    );
    setContribAmt('');
    setContribDate(todayISO());
    setContribProduct('Pasar Uang (PU)');
    setContribNote('');
  };

  const openJoinModal = () => {
    setJoinCode('');
    setJoinError(null);
    setJoinOpen(true);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    setJoinError(null);
    const res = await joinSharedGoal(joinCode);
    setJoinLoading(false);
    if (!res.ok) {
      setJoinError(res.error || 'Gagal bergabung ke goal bersama.');
      return;
    }
    setJoinOpen(false);
    setJoinCode('');
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

  const handleContribSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribGoal) return;
    const amount = parseAmountExpression(contribAmt).value;
    if (amount <= 0) return;
    addGoalContribution({
      goalId: contribGoal.id,
      contributorName: partnerName.trim() || (contribIsSelfMember ? dataset.profile.displayName : 'Pasangan'),
      isPartner: true,
      amount,
      date: contribDate || todayISO(),
      productName: contribProduct,
      note: contribNote.trim() || `Setoran ${contribGoal.name}`,
    });
    setContribGoal(null);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteGoal) return;
    const existing = dataset.goalInvites.find((i) => i.goalId === inviteGoal.id);
    const sharedPeer = dataset.sharedGoalPeers?.[inviteGoal.id];
    const code = (invCode || existing?.code || generateInviteCode()).trim().toUpperCase();
    saveGoalInvite({
      goalId: inviteGoal.id,
      code,
      partnerName: invPartnerName.trim() || 'Pasangan',
      partnerEmail: invPartnerEmail.trim(),
      sharePercent: Math.min(100, Math.max(0, Number(invShare) || 50)),
      status: sharedPeer?.memberId || existing?.status === 'joined' ? 'joined' : 'pending',
    });
    setInviteGoal(null);
  };

  const copyInviteText = (goal: Goal) => {
    const existing = dataset.goalInvites.find((i) => i.goalId === goal.id);
    const code = (invCode || existing?.code || generateInviteCode()).trim().toUpperCase();
    const text = `Yuk gabung pantau tabungan ${goal.name} di My Wallet! Buka menu Goals → klik "Gabung Goal" → masukkan kode: ${code}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleLeaveGoal = async (goal: Goal) => {
    const ok = window.confirm(
      `Keluar dari goal bersama "${goal.name}"? Dompet & transaksi pribadimu tidak akan terhapus.`
    );
    if (!ok) return;
    await leaveSharedGoal(goal.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
            Target Tabungan (Goals)
          </h1>
          <p className="text-xs text-[var(--mw-text-muted)]">
            Pantau target pribadi, tabungan Wedding lintas 2 akun bersama pasangan, dan rincian produk Bibit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {authMode === 'supabase' && (
            <button
              type="button"
              onClick={() => void refreshCloudData(false)}
              disabled={syncingCloud}
              title="Muat ulang data pasangan dari cloud"
              className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-[var(--mw-surface)] hover:bg-[var(--mw-surface-2)] text-[var(--mw-text)] border border-[var(--mw-border)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--mw-primary)] ${syncingCloud ? 'animate-spin' : ''}`} />
              <span>{syncingCloud ? 'Sync...' : 'Sync'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openJoinModal}
            className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--mw-surface)] hover:bg-[var(--mw-surface-2)] text-[var(--mw-text)] border border-[var(--mw-border)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
            <span>Gabung Goal</span>
          </button>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {dataset.goals.map((g) => {
          const sharedPeer = dataset.sharedGoalPeers?.[g.id];
          const prog = calculateGoalProgress(
            g,
            dataset.transactions,
            nowDate,
            dataset.goalContributions,
            dataset.investmentProducts,
            sharedPeer
          );
          const invite = dataset.goalInvites.find((i) => i.goalId === g.id);
          const isMember = g.sharedRole === 'member' || sharedPeer?.viewerRole === 'member';
          const isConnectedPeer = Boolean(sharedPeer?.memberId);
          const otherLabel = isMember
            ? sharedPeer?.ownerName || g.ownerName || 'Pasangan'
            : sharedPeer?.memberName || invite?.partnerName || 'Pasangan';

          const myPct = g.targetAmount > 0 ? Math.min(100, (prog.mySaved / g.targetAmount) * 100) : 0;
          const partnerPct =
            g.targetAmount > 0
              ? Math.min(100 - myPct, (prog.partnerSaved / g.targetAmount) * 100)
              : 0;
          const contribHistory = dataset.goalContributions
            .filter((c) => c.goalId === g.id)
            .sort((a, b) => b.date.localeCompare(a.date));

          return (
            <div key={g.id} className="mw-card rounded-3xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: `${g.color}22`, color: g.color }}
                    >
                      <DynamicIcon name={g.icon} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-[var(--mw-text)] truncate">
                          {g.name}
                        </h2>
                        {g.isShared && isMember && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--mw-primary-soft)] text-[var(--mw-primary)]">
                            <Users className="w-3 h-3" />
                            Bersama · Milik {otherLabel}
                          </span>
                        )}
                        {g.isShared && !isMember && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: isConnectedPeer
                                ? 'var(--mw-income-soft)'
                                : 'var(--mw-primary-soft)',
                              color: isConnectedPeer ? 'var(--mw-income)' : 'var(--mw-primary)',
                            }}
                          >
                            {isConnectedPeer ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Users className="w-3 h-3" />
                            )}
                            {isConnectedPeer
                              ? `Tersambung · ${otherLabel}`
                              : `Bersama · ${otherLabel}`}
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
                    {!isMember ? (
                      <>
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
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleLeaveGoal(g)}
                        aria-label={`Keluar dari goal ${g.name}`}
                        title="Keluar dari goal bersama"
                        className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-dim)] hover:text-red-400 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Dual-Segment Progress Bar (Aku + Pasangan) */}
                <div className="space-y-1.5">
                  <div className="h-3 rounded-full bg-[var(--mw-surface-2)] overflow-hidden flex">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${myPct}%`, background: g.color }}
                      title={`Kontribusimu: ${formatIDR(prog.mySaved, privacy)}`}
                    />
                    {g.isShared && partnerPct > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{ width: `${partnerPct}%`, background: 'var(--mw-saving)' }}
                        title={`${otherLabel}: ${formatIDR(prog.partnerSaved, privacy)}`}
                      />
                    )}
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

                {/* Split Aku vs Pasangan */}
                {g.isShared && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
                      <div className="flex items-center gap-1.5 text-[var(--mw-text-muted)]">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: g.color }}
                        />
                        <span>Kontribusimu</span>
                      </div>
                      <div className="font-bold tab-num text-[var(--mw-text)] mt-0.5">
                        {formatIDR(prog.mySaved, privacy)}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
                      <div className="flex items-center gap-1.5 text-[var(--mw-text-muted)]">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: 'var(--mw-saving)' }}
                        />
                        <span className="truncate">{otherLabel}</span>
                      </div>
                      <div className="font-bold tab-num text-[var(--mw-text)] mt-0.5">
                        {formatIDR(prog.partnerSaved, privacy)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Own Linked Bibit Investment Products Breakdown */}
                {prog.linkedProducts.length > 0 && (
                  <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--mw-text)] inline-flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                        Produk Bibit{g.isShared ? ' Milikmu' : ''} ({prog.linkedProducts.length})
                      </span>
                      {prog.myInvested > 0 && (
                        <span
                          className="font-semibold tab-num"
                          style={{
                            color:
                              prog.myMarketGain >= 0
                                ? 'var(--mw-income)'
                                : 'var(--mw-expense)',
                          }}
                        >
                          {prog.myMarketGain >= 0 ? '+' : ''}
                          {formatIDR(prog.myMarketGain, privacy)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {prog.linkedProducts.map((p) => {
                        const gain = p.marketValue - p.investedAmount;
                        const ret =
                          p.investedAmount > 0
                            ? ((gain / p.investedAmount) * 100).toFixed(1).replace('.', ',')
                            : null;
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 py-0.5"
                          >
                            <span className="inline-flex items-center gap-1.5 min-w-0 text-[var(--mw-text-muted)]">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: p.color }}
                              />
                              <span className="truncate">{p.name}</span>
                            </span>
                            <span className="tab-num font-semibold text-[var(--mw-text)] shrink-0">
                              {formatIDR(p.marketValue, privacy)}
                              {ret !== null && (
                                <span
                                  className="ml-1.5 text-[11px]"
                                  style={{
                                    color: gain >= 0 ? 'var(--mw-income)' : 'var(--mw-expense)',
                                  }}
                                >
                                  ({gain >= 0 ? '+' : ''}
                                  {ret}%)
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Peer Linked Bibit Investment Products Breakdown (Synced Cross-Account!) */}
                {g.isShared && prog.peerLinkedProducts.length > 0 && (
                  <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)]/80 border border-[var(--mw-border)] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--mw-text)] inline-flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[var(--mw-saving)]" />
                        Produk Bibit {otherLabel} ({prog.peerLinkedProducts.length})
                      </span>
                      {prog.partnerInvested > 0 && (
                        <span
                          className="font-semibold tab-num"
                          style={{
                            color:
                              prog.partnerMarketGain >= 0
                                ? 'var(--mw-income)'
                                : 'var(--mw-expense)',
                          }}
                        >
                          {prog.partnerMarketGain >= 0 ? '+' : ''}
                          {formatIDR(prog.partnerMarketGain, privacy)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {prog.peerLinkedProducts.map((p) => {
                        const gain = p.marketValue - p.investedAmount;
                        const ret =
                          p.investedAmount > 0
                            ? ((gain / p.investedAmount) * 100).toFixed(1).replace('.', ',')
                            : null;
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 py-0.5"
                          >
                            <span className="inline-flex items-center gap-1.5 min-w-0 text-[var(--mw-text-muted)]">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: p.color }}
                              />
                              <span className="truncate">{p.name}</span>
                            </span>
                            <span className="tab-num font-semibold text-[var(--mw-text)] shrink-0">
                              {formatIDR(p.marketValue, privacy)}
                              {ret !== null && (
                                <span
                                  className="ml-1.5 text-[11px]"
                                  style={{
                                    color: gain >= 0 ? 'var(--mw-income)' : 'var(--mw-expense)',
                                  }}
                                >
                                  ({gain >= 0 ? '+' : ''}
                                  {ret}%)
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Manual Contributions Recent List */}
                {g.isShared && contribHistory.length > 0 && (
                  <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)]/70 border border-[var(--mw-border)] space-y-1.5 text-xs">
                    <div className="font-semibold text-[var(--mw-text-muted)]">
                      Riwayat Setoran Manual ({contribHistory.length})
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto mw-scroll pr-1">
                      {contribHistory.map((c) => {
                        const canDelete =
                          authMode !== 'supabase' ||
                          !isMember ||
                          c.contributorUserId === dataset.profile.id;
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 py-0.5"
                          >
                            <div className="min-w-0">
                              <span className="text-[var(--mw-text)] font-medium truncate block">
                                {c.productName ? `${c.productName} · ` : ''}
                                {c.note}
                              </span>
                              <span className="text-[11px] text-[var(--mw-text-dim)]">
                                {c.contributorName} · {formatDateID(c.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-semibold tab-num text-[var(--mw-saving)]">
                                +{formatIDR(c.amount, privacy)}
                              </span>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => deleteGoalContribution(c.id)}
                                  className="p-1 rounded text-[var(--mw-text-dim)] hover:text-red-400 cursor-pointer"
                                  title="Hapus setoran"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Monthly Required */}
                <div className="p-3 rounded-xl bg-[var(--mw-surface-2)] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--mw-text-muted)]">
                    Sisa:{' '}
                    <b className="tab-num text-[var(--mw-text)]">
                      {formatIDR(prog.remaining, privacy)}
                    </b>
                  </span>
                  {prog.requiredPerMonth !== null && prog.remaining > 0 && (
                    <span className="font-semibold tab-num text-[var(--mw-primary)]">
                      Butuh {formatIDR(prog.requiredPerMonth, privacy)}/bln
                      {g.isShared
                        ? ` (±${formatIDR(Math.ceil(prog.requiredPerMonth / 2), privacy)}/org)`
                        : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    openQuickInput({
                      mode: 'create',
                      type: 'saving',
                      goalId: g.id,
                      // Avoid passing owner's foreign subcategory/wallet UUIDs when partner opens QuickInput
                      subcategoryId: isMember ? undefined : g.subcategoryId ?? undefined,
                      toWalletId: isMember ? undefined : g.walletId ?? undefined,
                    })
                  }
                  className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-semibold text-white transition cursor-pointer"
                  style={{ background: 'var(--mw-primary)' }}
                >
                  {isMember ? '+ Nabung dari Dompetku' : '+ Setor Danaku'}
                </button>
                {g.isShared && !isMember && (
                  <>
                    <button
                      type="button"
                      onClick={() => openContribModal(g, false)}
                      className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] text-[var(--mw-saving)] border border-[var(--mw-border)] transition cursor-pointer"
                    >
                      + Setoran {otherLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => openInviteModal(g)}
                      className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] text-[var(--mw-text)] border border-[var(--mw-border)] inline-flex items-center gap-1 transition cursor-pointer"
                      title="Undang & atur porsi pasangan"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                      <span>Undang</span>
                    </button>
                  </>
                )}
                {g.isShared && isMember && (
                  <button
                    type="button"
                    onClick={() => openContribModal(g, true)}
                    className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] text-[var(--mw-saving)] border border-[var(--mw-border)] transition cursor-pointer"
                  >
                    + Catat Setoranku
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Join Shared Goal Modal (Partner enters invite code) */}
      {joinOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <form
            onSubmit={handleJoinSubmit}
            className="w-full max-w-md mw-card rounded-3xl p-5 space-y-4 animate-sheet-up"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--mw-text)] inline-flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[var(--mw-primary)]" />
                Gabung Goal Bersama
              </h2>
              <button
                type="button"
                onClick={() => setJoinOpen(false)}
                className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[var(--mw-text-muted)] leading-relaxed">
                Masukkan kode undangan dari pasanganmu (contoh:{' '}
                <code className="font-mono font-semibold text-[var(--mw-primary)]">MW-4K9P-7X</code>
                ) untuk menghubungkan target tabungan bersama secara otomatis antar 2 akun.
              </p>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Kode Undangan</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase());
                    if (joinError) setJoinError(null);
                  }}
                  placeholder="MW-XXXX-XX"
                  className="w-full px-3.5 py-3 rounded-xl text-base font-mono font-bold tracking-widest uppercase bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div className="p-3 rounded-2xl bg-[var(--mw-primary-soft)] border border-[var(--mw-border)] flex items-start gap-2 text-[11px] text-[var(--mw-text-muted)]">
                <ShieldCheck className="w-4 h-4 text-[var(--mw-primary)] shrink-0 mt-0.5" />
                <span>
                  Privasi 100% aman: saldo dompet pribadi, gaji, budget, dan pengeluaran harianmu
                  tetap rahasia &amp; tidak dapat dilihat oleh pasangan.
                </span>
              </div>

              {joinError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  {joinError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setJoinOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={joinLoading || !joinCode.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                style={{ background: 'var(--mw-primary)' }}
              >
                {joinLoading ? 'Menghubungkan...' : 'Gabung Sekarang'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                  Jadikan Goal Bersama pasangan (aktifkan kontribusi gabungan &amp; kode undangan)
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

      {/* Partner / Manual Contribution Modal */}
      {contribGoal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <form
            onSubmit={handleContribSubmit}
            className="w-full max-w-md mw-card rounded-3xl p-5 space-y-4 animate-sheet-up"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--mw-text)]">
                {contribIsSelfMember
                  ? `Catat Setoranku · ${contribGoal.name}`
                  : `Catat Setoran Pasangan · ${contribGoal.name}`}
              </h2>
              <button
                type="button"
                onClick={() => setContribGoal(null)}
                className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {contribIsSelfMember && (
              <p className="text-[11px] text-[var(--mw-text-muted)] bg-[var(--mw-surface-2)] p-2.5 rounded-xl">
                Cocok jika ingin langsung mencatat setoran ke target {contribGoal.name} tanpa memotong
                saldo dompet pribadimu.
              </p>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[var(--mw-text-muted)] mb-1">
                    {contribIsSelfMember ? 'Namamu' : 'Nama Pasangan'}
                  </label>
                  <input
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--mw-text-muted)] mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={contribDate}
                    onChange={(e) => setContribDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Nominal Setoran</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={contribAmt}
                  onChange={(e) => setContribAmt(e.target.value)}
                  placeholder="Mis. 1,5jt atau 750rb"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">
                  Produk Bibit / Instrumen
                </label>
                <select
                  value={contribProduct}
                  onChange={(e) => setContribProduct(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                >
                  <option value="Pasar Uang (PU)">Pasar Uang (PU)</option>
                  <option value="Obligasi">Obligasi</option>
                  <option value="Reksa Saham">Reksa Saham</option>
                  <option value="Saham">Saham</option>
                  <option value="SBN">SBN (ORI/SBR/ST)</option>
                  <option value="Tabungan Bank">Tabungan Bank</option>
                  <option value="Lainnya">Produk Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Catatan</label>
                <input
                  type="text"
                  value={contribNote}
                  onChange={(e) => setContribNote(e.target.value)}
                  placeholder="Mis. Setoran rutin gajian"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContribGoal(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'var(--mw-saving)' }}
              >
                {contribIsSelfMember ? 'Simpan Setoranku' : 'Simpan Setoran Pasangan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invite Partner Modal */}
      {inviteGoal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <form
            onSubmit={handleInviteSubmit}
            className="w-full max-w-md mw-card rounded-3xl p-5 space-y-4 animate-sheet-up"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--mw-text)]">
                Berbagi Goal Bersama · {inviteGoal.name}
              </h2>
              <button
                type="button"
                onClick={() => setInviteGoal(null)}
                className="p-1.5 rounded-lg bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--mw-primary-soft)] border border-[var(--mw-border)] space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--mw-text-muted)]">Kode Undangan Pasangan:</span>
                {dataset.sharedGoalPeers?.[inviteGoal.id]?.memberId ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: 'var(--mw-income-soft)', color: 'var(--mw-income)' }}
                  >
                    <Check className="w-3 h-3" />
                    Tersambung
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--mw-text-dim)]">
                    Menunggu pasangan gabung
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-base font-extrabold tracking-widest text-[var(--mw-primary)]">
                  {invCode}
                </code>
                <button
                  type="button"
                  onClick={() => copyInviteText(inviteGoal)}
                  className="px-3 py-1.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                      <span>Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Undangan</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-[var(--mw-text-muted)]">
                Kirim kode ini ke pasanganmu via WhatsApp. Pasangan cukup login dengan akunnya
                sendiri, lalu buka <b>Goals → Gabung Goal</b>. Dompet pribadi &amp; transaksi
                harianmu tetap 100% privat.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">Nama Pasangan</label>
                <input
                  type="text"
                  value={invPartnerName}
                  onChange={(e) => setInvPartnerName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">
                  Email Akun Pasangan (opsional)
                </label>
                <input
                  type="email"
                  value={invPartnerEmail}
                  onChange={(e) => setInvPartnerEmail(e.target.value)}
                  placeholder="pasangan@gmail.com"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--mw-text-muted)] mb-1">
                  Target Porsi Pasangan ({invShare}% · Kamu {100 - (Number(invShare) || 0)}%)
                </label>
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  value={invShare}
                  onChange={(e) => setInvShare(e.target.value)}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInviteGoal(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ background: 'var(--mw-primary)' }}
              >
                Simpan Pengaturan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
