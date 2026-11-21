import type { SupabaseClient } from '@supabase/supabase-js';
import { createInitialDataset, createSeedCategories, createSeedGoals, createSeedTemplates, createSeedWallets, todayISO } from '@/lib/seed';
import type {
  AppDataset,
  Category,
  Goal,
  QuickTemplate,
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
    };
  }

  const [walletsRes, catsRes, subsRes, goalsRes, txRes, valRes, tplRes] = await Promise.all([
    supabase.from('wallets').select('*').eq('owner_id', userId).order('sort_order'),
    supabase.from('categories').select('*').eq('owner_id', userId).order('sort_order'),
    supabase.from('subcategories').select('*').eq('owner_id', userId).order('sort_order'),
    supabase.from('goals').select('*').eq('owner_id', userId).order('priority'),
    supabase.from('transactions').select('*').eq('owner_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('wallet_valuations').select('*').eq('owner_id', userId).order('date', { ascending: false }),
    supabase.from('templates').select('*').eq('owner_id', userId).order('sort_order'),
  ]);

  let wallets: Wallet[] = (walletsRes.data ?? []).map(mapWalletFromDb);
  let categories: Category[] = (catsRes.data ?? []).map(mapCategoryFromDb);
  let subcategories: Subcategory[] = (subsRes.data ?? []).map(mapSubFromDb);
  let goals: Goal[] = (goalsRes.data ?? []).map(mapGoalFromDb);
  const transactions: Transaction[] = (txRes.data ?? []).map(mapTxFromDb);
  const valuations: WalletValuation[] = (valRes.data ?? []).map(mapValuationFromDb);
  let templates: QuickTemplate[] = (tplRes.data ?? []).map(mapTemplateFromDb);

  // First-time cloud seeding
  if (wallets.length === 0 && categories.length === 0) {
    const seeded = await seedSupabaseUser(supabase, userId);
    wallets = seeded.wallets;
    categories = seeded.categories;
    subcategories = seeded.subcategories;
    goals = seeded.goals;
    templates = seeded.templates;
  }

  return {
    profile,
    wallets,
    categories,
    subcategories,
    goals,
    transactions,
    valuations,
    templates,
  };
}

async function seedSupabaseUser(supabase: SupabaseClient, userId: string) {
  const walletIdMap = new Map<string, string>();
  const catIdMap = new Map<string, string>();
  const subIdMap = new Map<string, string>();
  const goalIdMap = new Map<string, string>();

  const seedWallets = createSeedWallets().map((w) => {
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

  const seedGoals = createSeedGoals().map((g) => {
    const newId = generateUUID();
    goalIdMap.set(g.id, newId);
    return {
      ...g,
      id: newId,
      walletId: g.walletId ? walletIdMap.get(g.walletId) ?? null : null,
      subcategoryId: g.subcategoryId ? subIdMap.get(g.subcategoryId) ?? null : null,
    };
  });

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
function mapGoalFromDb(r: any): Goal {
  return {
    id: r.id,
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
