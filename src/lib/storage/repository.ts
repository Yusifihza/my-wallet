import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInviteCode } from '@/lib/finance';
import {
  createInitialDataset,
  createSeedCategories,
  createSeedGoals,
  createSeedInvestmentProducts,
  createSeedTemplates,
  createSeedWallets,
  todayISO,
} from '@/lib/seed';
import type {
  AIMemory,
  AppDataset,
  Category,
  Goal,
  GoalContribution,
  GoalInvite,
  InvestmentProduct,
  QuickTemplate,
  RecurringRule,
  SharedGoalPeerData,
  SheetsSyncConfig,
  Subcategory,
  Transaction,
  UserProfile,
  Wallet,
  WalletValuation,
} from '@/types/finance';

const LOCAL_STORAGE_KEY = 'my_wallet_dataset_v1';
const LOCAL_MODE_FLAG = 'my_wallet_local_mode_v1';

export function isLocalModeOptedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LOCAL_MODE_FLAG) === 'true';
}

export function setLocalModeOptIn(enabled: boolean) {
  if (typeof window === 'undefined') return;
  if (enabled) window.localStorage.setItem(LOCAL_MODE_FLAG, 'true');
  else window.localStorage.removeItem(LOCAL_MODE_FLAG);
}

export function loadLocalDataset(): AppDataset {
  if (typeof window === 'undefined') return createInitialDataset();
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialDataset('Kamu', todayISO());
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<AppDataset>;
    const fallback = createInitialDataset('Kamu', todayISO());
    return {
      profile: { ...fallback.profile, ...(parsed.profile ?? {}) },
      wallets: parsed.wallets?.length ? parsed.wallets : fallback.wallets,
      categories: parsed.categories?.length ? parsed.categories : fallback.categories,
      subcategories: parsed.subcategories?.length ? parsed.subcategories : fallback.subcategories,
      goals: parsed.goals ?? fallback.goals,
      transactions: parsed.transactions ?? [],
      valuations: parsed.valuations ?? [],
      investmentProducts:
        parsed.investmentProducts !== undefined
          ? parsed.investmentProducts
          : fallback.investmentProducts,
      goalContributions: parsed.goalContributions ?? [],
      goalInvites: parsed.goalInvites?.length ? parsed.goalInvites : fallback.goalInvites,
      recurringRules: parsed.recurringRules ?? [],
      aiMemory: {
        patterns: parsed.aiMemory?.patterns ?? [],
        preferences: parsed.aiMemory?.preferences ?? {},
        feedbackLog: parsed.aiMemory?.feedbackLog ?? [],
      },
      sheetsSync: { ...fallback.sheetsSync, ...(parsed.sheetsSync ?? {}) },
      templates: parsed.templates?.length ? parsed.templates : fallback.templates,
    };
  } catch {
    return createInitialDataset('Kamu', todayISO());
  }
}

export function saveLocalDataset(dataset: AppDataset) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataset));
  } catch {
    // Storage quota exceeded - ignore gracefully
  }
}

export function resetLocalDataset(): AppDataset {
  const fresh = createInitialDataset('Kamu', todayISO());
  saveLocalDataset(fresh);
  return fresh;
}

// ==================== SUPABASE CLOUD ADAPTER ====================

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export { generateUUID };

/**
 * Loads user's cloud dataset from Supabase. If this is a brand-new user with no
 * wallets/categories yet, seeds their account with the finalized Blueprint seed data.
 */
export async function loadSupabaseDataset(
  supabase: SupabaseClient,
  userId: string,
  userMeta?: { name?: string; email?: string; avatarUrl?: string }
): Promise<AppDataset> {
  // Ensure profile exists
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  let profile: UserProfile;
  if (!profileRow) {
    const displayName = userMeta?.name || userMeta?.email?.split('@')[0] || 'Kamu';
    await supabase.from('profiles').upsert({
      id: userId,
      display_name: displayName,
      avatar_url: userMeta?.avatarUrl ?? null,
      theme: 'dark',
    });
    profile = {
      id: userId,
      displayName,
      email: userMeta?.email,
      avatarUrl: userMeta?.avatarUrl,
      cycleStartDay: 1,
      timezone: 'Asia/Jakarta',
      theme: 'dark',
      privacyMode: false,
      onboardingCompleted: false,
      isDemoData: false,
    };
  } else {
    profile = {
      id: profileRow.id,
      displayName: profileRow.display_name,
      email: userMeta?.email,
      avatarUrl: profileRow.avatar_url ?? userMeta?.avatarUrl,
      cycleStartDay: profileRow.cycle_start_day ?? 1,
      timezone: profileRow.timezone ?? 'Asia/Jakarta',
      theme: profileRow.theme ?? 'dark',
      privacyMode: Boolean(profileRow.privacy_mode),
      onboardingCompleted: Boolean(profileRow.onboarding_completed),
      isDemoData: false,
    };
  }

  const [
    walletsRes,
    catsRes,
    subsRes,
    goalsRes,
    txRes,
    valRes,
    tplRes,
    prodRes,
    recRes,
    memRes,
    sheetsRes,
  ] = await Promise.all([
    supabase.from('wallets').select('*').eq('owner_id', userId).order('sort_order'),
    supabase.from('categories').select('*').eq('owner_id', userId).order('sort_order'),
    supabase.from('subcategories').select('*').eq('owner_id', userId).order('sort_order'),
    // RLS returns own goals + shared goals the user joined as a member
    supabase.from('goals').select('*').order('priority'),
    supabase
      .from('transactions')
      .select('*')
      .eq('owner_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('wallet_valuations').select('*').eq('owner_id', userId).order('date', { ascending: false }),
    supabase.from('templates').select('*').eq('owner_id', userId).order('sort_order'),
    // RLS returns own products + peer products linked to accessible shared goals
    supabase.from('investment_products').select('*').order('sort_order'),
    supabase.from('recurring_rules').select('*').eq('owner_id', userId).order('next_run'),
    supabase.from('ai_memory').select('*').eq('owner_id', userId).maybeSingle(),
    supabase.from('sheets_sync').select('*').eq('owner_id', userId).maybeSingle(),
  ]);

  let wallets: Wallet[] = (walletsRes.data ?? []).map(mapWalletFromDb);
  let categories: Category[] = (catsRes.data ?? []).map(mapCategoryFromDb);
  let subcategories: Subcategory[] = (subsRes.data ?? []).map(mapSubFromDb);
  let goals: Goal[] = (goalsRes.data ?? []).map((r) => mapGoalFromDb(r, userId));
  const transactions: Transaction[] = (txRes.data ?? []).map(mapTxFromDb);
  const valuations: WalletValuation[] = (valRes.data ?? []).map(mapValuationFromDb);
  let templates: QuickTemplate[] = (tplRes.data ?? []).map(mapTemplateFromDb);

  const allProducts: InvestmentProduct[] = (prodRes.data ?? []).map(mapProductFromDb);
  // Keep ONLY own products inside dataset.investmentProducts so peer assets NEVER inflate personal Net Worth
  let investmentProducts: InvestmentProduct[] = allProducts.filter(
    (p) => !p.ownerId || p.ownerId === userId
  );
  const peerProductsByGoal = new Map<string, InvestmentProduct[]>();
  for (const p of allProducts) {
    if (p.ownerId && p.ownerId !== userId && p.goalId) {
      const list = peerProductsByGoal.get(p.goalId) ?? [];
      list.push(p);
      peerProductsByGoal.set(p.goalId, list);
    }
  }

  const recurringRules: RecurringRule[] = (recRes.data ?? []).map(mapRecurringFromDb);

  const aiMemory: AIMemory = memRes.data
    ? {
        patterns: Array.isArray(memRes.data.patterns) ? memRes.data.patterns : [],
        preferences: memRes.data.preferences ?? {},
        feedbackLog: Array.isArray(memRes.data.feedback_log) ? memRes.data.feedback_log : [],
      }
    : { patterns: [], preferences: {}, feedbackLog: [] };

  const sheetsSync: SheetsSyncConfig = sheetsRes.data
    ? {
        status: sheetsRes.data.status === 'connected' ? 'connected' : 'disconnected',
        spreadsheetId: sheetsRes.data.spreadsheet_id ?? '',
        spreadsheetUrl: sheetsRes.data.spreadsheet_url ?? '',
        autoSync: Boolean(sheetsRes.data.auto_sync),
        lastSyncedAt: sheetsRes.data.last_synced_at ?? null,
      }
    : {
        status: 'disconnected',
        spreadsheetId: '',
        spreadsheetUrl: '',
        autoSync: false,
        lastSyncedAt: null,
      };

  let seededInvites: GoalInvite[] = [];

  // First-time cloud seeding
  if (wallets.length === 0 && categories.length === 0) {
    const seeded = await seedSupabaseUser(supabase, userId);
    wallets = seeded.wallets;
    categories = seeded.categories;
    subcategories = seeded.subcategories;
    // Preserve any joined shared goals if somehow already present
    const joinedGoals = goals.filter((g) => g.sharedRole === 'member');
    goals = [...joinedGoals, ...seeded.goals];
    templates = seeded.templates;
    investmentProducts = seeded.investmentProducts;
    seededInvites = seeded.goalInvites;
  }

  // Sort so joined shared goals appear prominently alongside own goals
  goals = [...goals].sort(
    (a, b) =>
      (a.sharedRole === 'member' ? 0 : 1) - (b.sharedRole === 'member' ? 0 : 1) ||
      a.priority - b.priority
  );

  const accessibleGoalIds = goals.map((g) => g.id);
  const sharedGoalIds = goals.filter((g) => g.isShared).map((g) => g.id);

  let goalContributions: GoalContribution[] = [];
  let goalInvites: GoalInvite[] = seededInvites;

  if (accessibleGoalIds.length > 0) {
    const [contribRes, inviteRes] = await Promise.all([
      supabase
        .from('goal_contributions')
        .select('*')
        .in('goal_id', accessibleGoalIds)
        .order('date', { ascending: false }),
      supabase.from('goal_invites').select('*').in('goal_id', accessibleGoalIds),
    ]);
    goalContributions = (contribRes.data ?? []).map(mapContributionFromDb);
    const dbInvites = (inviteRes.data ?? []).map(mapInviteFromDb);
    if (dbInvites.length > 0) {
      goalInvites = dbInvites;
    }
  }

  // Fetch safe peer display names & peer non-Bibit saving totals via Migration 002 RPCs
  // Wrapped gracefully so the app stays healthy even before SQL 002 is executed
  const sharedGoalPeers: Record<string, SharedGoalPeerData> = {};
  if (sharedGoalIds.length > 0) {
    type PeerRow = {
      goal_id: string;
      owner_id: string;
      owner_name: string | null;
      member_user_id: string | null;
      member_name: string | null;
      share_percent: number | null;
    };
    type TxTotalRow = {
      goal_id: string;
      user_id: string;
      tx_saved: number | string;
    };

    let peerRows: PeerRow[] = [];
    let txTotalRows: TxTotalRow[] = [];
    try {
      const [peersRpc, txRpc] = await Promise.all([
        supabase.rpc('get_shared_goal_peers', { p_goal_ids: sharedGoalIds }),
        supabase.rpc('get_shared_goal_tx_totals', { p_goal_ids: sharedGoalIds }),
      ]);
      if (!peersRpc.error && Array.isArray(peersRpc.data)) {
        peerRows = peersRpc.data as PeerRow[];
      }
      if (!txRpc.error && Array.isArray(txRpc.data)) {
        txTotalRows = txRpc.data as TxTotalRow[];
      }
    } catch {
      // Migration 002 not applied yet — degrade gracefully without crashing
    }

    for (const g of goals) {
      if (!g.isShared) continue;
      const matchingPeers = peerRows.filter((r) => r.goal_id === g.id);
      const bestPeer =
        matchingPeers.find((r) => r.member_user_id && r.member_user_id !== userId) ??
        matchingPeers.find((r) => r.member_user_id) ??
        matchingPeers[0];

      const invite = goalInvites.find((i) => i.goalId === g.id);
      const viewerRole: 'owner' | 'member' = g.ownerId && g.ownerId !== userId ? 'member' : 'owner';

      const peerTxSaved = txTotalRows
        .filter((r) => r.goal_id === g.id && r.user_id !== userId)
        .reduce((sum, r) => sum + Number(r.tx_saved ?? 0), 0);

      const ownerName = bestPeer?.owner_name?.trim() || 'Pasangan';
      const memberName = bestPeer?.member_name?.trim() || invite?.partnerName || null;

      if (viewerRole === 'member') {
        g.ownerName = ownerName;
      }

      sharedGoalPeers[g.id] = {
        goalId: g.id,
        ownerId: bestPeer?.owner_id ?? g.ownerId ?? userId,
        ownerName,
        memberId: bestPeer?.member_user_id ?? (viewerRole === 'member' ? userId : null),
        memberName,
        sharePercent: Number(bestPeer?.share_percent ?? invite?.sharePercent ?? 50),
        viewerRole,
        peerProducts: peerProductsByGoal.get(g.id) ?? [],
        peerTxSaved,
      };
    }
  }

  return {
    profile,
    wallets,
    categories,
    subcategories,
    goals,
    transactions,
    valuations,
    investmentProducts,
    goalContributions,
    goalInvites,
    sharedGoalPeers,
    recurringRules,
    aiMemory,
    sheetsSync,
    templates,
  };
}

export async function joinSharedGoalByCode(
  supabase: SupabaseClient,
  code: string
): Promise<{ ok: boolean; goalId?: string; goalName?: string; ownerName?: string; error?: string }> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) {
    return { ok: false, error: 'Masukkan kode undangan dari pasanganmu.' };
  }
  try {
    const { data, error } = await supabase.rpc('join_shared_goal', { p_code: cleaned });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (
        error.code === 'PGRST202' ||
        msg.includes('could not find the function') ||
        msg.includes('does not exist')
      ) {
        return {
          ok: false,
          error:
            'Database Supabase belum menjalankan migrasi Shared Goals. Jalankan file SQL 002_shared_goals_sync.sql di Supabase SQL Editor dulu ya.',
        };
      }
      return { ok: false, error: error.message || 'Gagal bergabung ke goal bersama.' };
    }
    const payload = (data ?? {}) as {
      ok?: boolean;
      goal_id?: string;
      goal_name?: string;
      owner_name?: string;
      error?: string;
    };
    if (!payload.ok) {
      return { ok: false, error: payload.error || 'Kode undangan tidak valid.' };
    }
    return {
      ok: true,
      goalId: payload.goal_id,
      goalName: payload.goal_name,
      ownerName: payload.owner_name,
    };
  } catch {
    return { ok: false, error: 'Gagal terhubung ke server Supabase. Cek koneksi internetmu.' };
  }
}

export async function leaveSharedGoalById(
  supabase: SupabaseClient,
  goalId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('leave_shared_goal', { p_goal_id: goalId });
    if (error) {
      return { ok: false, error: error.message || 'Gagal keluar dari goal bersama.' };
    }
    const payload = (data ?? {}) as { ok?: boolean; error?: string };
    if (!payload.ok) {
      return { ok: false, error: payload.error || 'Gagal keluar dari goal bersama.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Gagal terhubung ke server Supabase.' };
  }
}

async function seedSupabaseUser(supabase: SupabaseClient, userId: string) {
  const walletIdMap = new Map<string, string>();
  const catIdMap = new Map<string, string>();
  const subIdMap = new Map<string, string>();
  const goalIdMap = new Map<string, string>();
  const today = todayISO();

  const seedWallets = createSeedWallets(today).map((w) => {
    const newId = generateUUID();
    walletIdMap.set(w.id, newId);
    return { ...w, id: newId };
  });

  const { categories: rawCats, subcategories: rawSubs } = createSeedCategories();
  const seedCategories = rawCats.map((c) => {
    const newId = generateUUID();
    catIdMap.set(c.id, newId);
    return { ...c, id: newId };
  });
  const seedSubcategories = rawSubs.map((s) => {
    const newId = generateUUID();
    subIdMap.set(s.id, newId);
    return { ...s, id: newId, categoryId: catIdMap.get(s.categoryId) ?? s.categoryId };
  });

  const seedGoals: Goal[] = createSeedGoals().map((g) => {
    const newId = generateUUID();
    goalIdMap.set(g.id, newId);
    return {
      ...g,
      id: newId,
      ownerId: userId,
      sharedRole: 'owner',
      walletId: g.walletId ? walletIdMap.get(g.walletId) ?? null : null,
      subcategoryId: g.subcategoryId ? subIdMap.get(g.subcategoryId) ?? null : null,
    };
  });

  const seedGoalInvites: GoalInvite[] = seedGoals
    .filter((g) => g.isShared)
    .map((g) => ({
      goalId: g.id,
      code: generateInviteCode(),
      partnerName: 'Pasangan',
      partnerEmail: '',
      sharePercent: 50,
      status: 'pending',
    }));

  const seedProducts: InvestmentProduct[] = createSeedInvestmentProducts(today).map((p) => ({
    ...p,
    id: generateUUID(),
    ownerId: userId,
    walletId: walletIdMap.get(p.walletId) ?? seedWallets[0].id,
    goalId: p.goalId ? goalIdMap.get(p.goalId) ?? null : null,
  }));

  const seedTemplates = createSeedTemplates().map((t) => ({
    ...t,
    id: generateUUID(),
    walletId: walletIdMap.get(t.walletId) ?? seedWallets[0].id,
    toWalletId: t.toWalletId ? walletIdMap.get(t.toWalletId) ?? null : null,
    subcategoryId: t.subcategoryId ? subIdMap.get(t.subcategoryId) ?? null : null,
    goalId: t.goalId ? goalIdMap.get(t.goalId) ?? null : null,
  }));

  await supabase.from('wallets').insert(seedWallets.map((w) => mapWalletToDb(w, userId)));
  await supabase.from('categories').insert(seedCategories.map((c) => mapCategoryToDb(c, userId)));
  await supabase.from('subcategories').insert(seedSubcategories.map((s) => mapSubToDb(s, userId)));
  await supabase.from('goals').insert(seedGoals.map((g) => mapGoalToDb(g, userId)));
  if (seedGoalInvites.length > 0) {
    await supabase.from('goal_invites').insert(seedGoalInvites.map((i) => mapInviteToDb(i, userId)));
  }
  await supabase.from('investment_products').insert(seedProducts.map((p) => mapProductToDb(p, userId)));
  await supabase.from('templates').insert(
    seedTemplates.map((t, idx) => ({
      id: t.id,
      owner_id: userId,
      name: t.label,
      payload: t,
      sort_order: idx + 1,
    }))
  );

  return {
    wallets: seedWallets,
    categories: seedCategories,
    subcategories: seedSubcategories,
    goals: seedGoals,
    goalInvites: seedGoalInvites,
    investmentProducts: seedProducts,
    templates: seedTemplates,
  };
}

// ==================== DB MAPPERS ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWalletFromDb(r: any): Wallet {
  return {
    id: r.id,
    name: r.name,
    group: r.wallet_group,
    kind: r.kind,
    openingBalance: Number(r.opening_balance ?? 0),
    openingDate: r.opening_date,
    icon: r.icon,
    color: r.color,
    includeInTotal: Boolean(r.include_in_total),
    hidden: Boolean(r.hidden),
    archived: Boolean(r.archived),
    sortOrder: Number(r.sort_order ?? 0),
  };
}

export function mapWalletToDb(w: Wallet, ownerId: string) {
  return {
    id: w.id,
    owner_id: ownerId,
    name: w.name,
    wallet_group: w.group,
    kind: w.kind,
    opening_balance: Math.round(w.openingBalance),
    opening_date: w.openingDate,
    icon: w.icon,
    color: w.color,
    include_in_total: w.includeInTotal,
    hidden: w.hidden,
    archived: w.archived,
    sort_order: w.sortOrder,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCategoryFromDb(r: any): Category {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    budgetCap: r.budget_cap !== null && r.budget_cap !== undefined ? Number(r.budget_cap) : null,
    icon: r.icon,
    color: r.color,
    archived: Boolean(r.archived),
    sortOrder: Number(r.sort_order ?? 0),
  };
}

export function mapCategoryToDb(c: Category, ownerId: string) {
  return {
    id: c.id,
    owner_id: ownerId,
    type: c.type,
    name: c.name,
    budget_cap: c.budgetCap,
    icon: c.icon,
    color: c.color,
    archived: c.archived,
    sort_order: c.sortOrder,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSubFromDb(r: any): Subcategory {
  return {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    monthlyBudget: r.monthly_budget !== null && r.monthly_budget !== undefined ? Number(r.monthly_budget) : null,
    aliases: Array.isArray(r.aliases) ? r.aliases : [],
    defaultNotes: Array.isArray(r.default_notes) ? r.default_notes : [],
    archived: Boolean(r.archived),
    sortOrder: Number(r.sort_order ?? 0),
  };
}

export function mapSubToDb(s: Subcategory, ownerId: string) {
  return {
    id: s.id,
    owner_id: ownerId,
    category_id: s.categoryId,
    name: s.name,
    monthly_budget: s.monthlyBudget,
    aliases: s.aliases,
    default_notes: s.defaultNotes,
    archived: s.archived,
    sort_order: s.sortOrder,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGoalFromDb(r: any, viewerUserId?: string): Goal {
  const ownerId = r.owner_id ?? undefined;
  return {
    id: r.id,
    ownerId,
    sharedRole: viewerUserId && ownerId && ownerId !== viewerUserId ? 'member' : 'owner',
    name: r.name,
    icon: r.icon,
    targetAmount: Number(r.target_amount ?? 0),
    deadline: r.deadline ?? null,
    walletId: r.wallet_id ?? null,
    subcategoryId: r.subcategory_id ?? null,
    priority: Number(r.priority ?? 1),
    color: r.color ?? '#10b981',
    isShared: Boolean(r.is_shared),
    status: r.status ?? 'active',
  };
}

export function mapGoalToDb(g: Goal, ownerId: string) {
  return {
    id: g.id,
    owner_id: ownerId,
    name: g.name,
    icon: g.icon,
    target_amount: Math.round(g.targetAmount),
    deadline: g.deadline,
    wallet_id: g.walletId,
    subcategory_id: g.subcategoryId,
    priority: g.priority,
    color: g.color,
    is_shared: g.isShared,
    status: g.status,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductFromDb(r: any): InvestmentProduct {
  return {
    id: r.id,
    ownerId: r.owner_id ?? undefined,
    walletId: r.wallet_id,
    goalId: r.goal_id ?? null,
    name: r.name,
    assetClass: r.asset_class ?? 'pu',
    investedAmount: Number(r.invested_amount ?? 0),
    marketValue: Number(r.market_value ?? 0),
    color: r.color ?? '#10b981',
    updatedAt: r.updated_at ?? todayISO(),
    sortOrder: Number(r.sort_order ?? 0),
  };
}

export function mapProductToDb(p: InvestmentProduct, ownerId: string) {
  return {
    id: p.id,
    owner_id: ownerId,
    wallet_id: p.walletId,
    goal_id: p.goalId,
    name: p.name,
    asset_class: p.assetClass,
    invested_amount: Math.round(p.investedAmount),
    market_value: Math.round(p.marketValue),
    color: p.color,
    updated_at: p.updatedAt,
    sort_order: p.sortOrder,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContributionFromDb(r: any): GoalContribution {
  return {
    id: r.id,
    goalId: r.goal_id,
    contributorUserId: r.contributor_user_id ?? r.owner_id ?? null,
    contributorName: r.contributor_name ?? 'Pasangan',
    isPartner: Boolean(r.is_partner),
    amount: Number(r.amount ?? 0),
    date: r.date,
    productName: r.product_name ?? '',
    note: r.note ?? '',
  };
}

export function mapContributionToDb(
  c: GoalContribution,
  ownerId: string,
  includeContributorUserId = true
) {
  const base = {
    id: c.id,
    owner_id: ownerId,
    goal_id: c.goalId,
    contributor_name: c.contributorName,
    is_partner: c.isPartner,
    amount: Math.round(c.amount),
    date: c.date,
    product_name: c.productName ?? '',
    note: c.note,
  };
  return includeContributorUserId
    ? { ...base, contributor_user_id: c.contributorUserId ?? ownerId }
    : base;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInviteFromDb(r: any): GoalInvite {
  return {
    goalId: r.goal_id,
    code: String(r.code ?? '').trim().toUpperCase(),
    partnerName: r.partner_name ?? 'Pasangan',
    partnerEmail: r.partner_email ?? '',
    sharePercent: Number(r.share_percent ?? 50),
    status: r.status === 'joined' ? 'joined' : 'pending',
  };
}

export function mapInviteToDb(inv: GoalInvite, ownerId: string) {
  return {
    goal_id: inv.goalId,
    owner_id: ownerId,
    code: inv.code.trim().toUpperCase(),
    partner_name: inv.partnerName,
    partner_email: inv.partnerEmail,
    share_percent: inv.sharePercent,
    status: inv.status,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecurringFromDb(r: any): RecurringRule {
  const tpl = r.template ?? {};
  return {
    id: r.id,
    label: tpl.label ?? 'Jadwal Rutin',
    type: tpl.type ?? 'expense',
    amount: Number(tpl.amount ?? 0),
    subcategoryId: tpl.subcategoryId ?? null,
    walletId: tpl.walletId ?? '',
    toWalletId: tpl.toWalletId ?? null,
    goalId: tpl.goalId ?? null,
    investmentProductId: tpl.investmentProductId ?? null,
    note: tpl.note ?? '',
    frequency: r.frequency ?? 'monthly',
    dayOfMonth: Number(r.day_of_month ?? 1),
    nextRun: r.next_run,
    active: Boolean(r.active),
  };
}

export function mapRecurringToDb(rule: RecurringRule, ownerId: string) {
  return {
    id: rule.id,
    owner_id: ownerId,
    template: {
      label: rule.label,
      type: rule.type,
      amount: Math.round(rule.amount),
      subcategoryId: rule.subcategoryId,
      walletId: rule.walletId,
      toWalletId: rule.toWalletId,
      goalId: rule.goalId,
      investmentProductId: rule.investmentProductId ?? null,
      note: rule.note,
    },
    frequency: rule.frequency,
    day_of_month: rule.dayOfMonth,
    auto_create: false,
    next_run: rule.nextRun,
    active: rule.active,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTxFromDb(r: any): Transaction {
  return {
    id: r.id,
    date: r.date,
    type: r.type,
    subcategoryId: r.subcategory_id ?? null,
    walletId: r.wallet_id,
    toWalletId: r.to_wallet_id ?? null,
    amount: Number(r.amount ?? 0),
    fee: Number(r.fee ?? 0),
    goalId: r.goal_id ?? null,
    investmentProductId: r.investment_product_id ?? null,
    note: r.note ?? '',
    createdAt: r.created_at,
  };
}

export function mapTxToDb(tx: Transaction, ownerId: string) {
  return {
    id: tx.id,
    owner_id: ownerId,
    date: tx.date,
    type: tx.type,
    subcategory_id: tx.subcategoryId,
    wallet_id: tx.walletId,
    to_wallet_id: tx.toWalletId,
    amount: Math.round(tx.amount),
    fee: Math.round(tx.fee ?? 0),
    goal_id: tx.goalId,
    investment_product_id: tx.investmentProductId ?? null,
    note: tx.note,
    created_at: tx.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapValuationFromDb(r: any): WalletValuation {
  return {
    id: r.id,
    walletId: r.wallet_id,
    date: r.date,
    marketValue: Number(r.market_value ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplateFromDb(r: any): QuickTemplate {
  return r.payload as QuickTemplate;
}
