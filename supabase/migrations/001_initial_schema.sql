-- My Wallet — Complete PostgreSQL Schema (Supabase)
-- Covers Phase 1 MVP + Phase 2 (Bibit Multi-Product Portfolio, Shared Goals & Partner Contributions, Recurring, Sheets Sync) + Phase 3 (AI Advisor & AI Memory)
-- Aman dijalankan ulang (idempotent) di Supabase SQL Editor.

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Pengguna',
  avatar_url text,
  cycle_start_day int not null default 1 check (cycle_start_day between 1 and 28),
  timezone text not null default 'Asia/Jakarta',
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  privacy_mode boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. WALLETS
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  wallet_group text not null check (wallet_group in ('cash', 'bank', 'ewallet', 'emoney', 'investment', 'credit')),
  kind text not null default 'asset' check (kind in ('asset', 'liability')),
  opening_balance bigint not null default 0,
  opening_date date not null default current_date,
  icon text not null default 'wallet',
  color text not null default '#10b981',
  include_in_total boolean not null default true,
  hidden boolean not null default false,
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 3. CATEGORIES & SUBCATEGORIES
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'saving')),
  name text not null,
  budget_cap bigint check (budget_cap is null or budget_cap >= 0),
  icon text not null default 'tag',
  color text not null default '#10b981',
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  monthly_budget bigint check (monthly_budget is null or monthly_budget >= 0),
  aliases text[] not null default '{}',
  default_notes text[] not null default '{}',
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 4. GOALS, SHARED GOAL MEMBERS, INVITES & PARTNER CONTRIBUTIONS
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  icon text not null default 'target',
  target_amount bigint not null check (target_amount > 0),
  deadline date,
  wallet_id uuid references public.wallets(id) on delete set null,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  priority int not null default 1,
  color text not null default '#10b981',
  is_shared boolean not null default false,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.goal_members (
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  share_percent int not null default 50 check (share_percent between 0 and 100),
  joined_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);

create table if not exists public.goal_invites (
  goal_id uuid primary key references public.goals(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  partner_name text not null default 'Pasangan',
  partner_email text not null default '',
  share_percent int not null default 50 check (share_percent between 0 and 100),
  status text not null default 'pending' check (status in ('pending', 'joined')),
  created_at timestamptz not null default now()
);

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  contributor_name text not null default 'Pasangan',
  is_partner boolean not null default true,
  amount bigint not null check (amount > 0),
  date date not null default current_date,
  product_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- 5. INVESTMENT PRODUCTS (Bibit Multi-Product: PU, Obligasi, Reksa Saham, Saham, SBN, dll.)
create table if not exists public.investment_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  name text not null,
  asset_class text not null default 'pu' check (asset_class in ('pu', 'obligasi', 'reksa_saham', 'saham', 'sbn', 'emas', 'campuran', 'lainnya')),
  invested_amount bigint not null default 0 check (invested_amount >= 0),
  market_value bigint not null default 0 check (market_value >= 0),
  color text not null default '#10b981',
  updated_at date not null default current_date,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 6. TRANSACTIONS
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('income', 'expense', 'saving', 'saving_withdrawal', 'transfer', 'adjustment')),
  subcategory_id uuid references public.subcategories(id) on delete set null,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  to_wallet_id uuid references public.wallets(id) on delete restrict,
  amount bigint not null,
  fee bigint not null default 0 check (fee >= 0),
  goal_id uuid references public.goals(id) on delete set null,
  investment_product_id uuid references public.investment_products(id) on delete set null,
  note text not null default '',
  recurring_rule_id uuid,
  created_at timestamptz not null default now(),
  constraint amount_check check (
    (type = 'adjustment' and amount <> 0) or (type <> 'adjustment' and amount > 0)
  )
);

alter table public.transactions
  add column if not exists investment_product_id uuid references public.investment_products(id) on delete set null;

create index if not exists idx_transactions_owner_date on public.transactions(owner_id, date desc);
create index if not exists idx_transactions_wallet on public.transactions(wallet_id);
create index if not exists idx_transactions_to_wallet on public.transactions(to_wallet_id);
create index if not exists idx_transactions_goal on public.transactions(goal_id);

-- 7. BUDGET PERIODS (historical monthly snapshots)
create table if not exists public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  month text not null, -- YYYY-MM
  category_id uuid references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete cascade,
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now()
);

-- 8. WALLET VALUATIONS (Bibit historical market value snapshots)
create table if not exists public.wallet_valuations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  date date not null default current_date,
  market_value bigint not null check (market_value >= 0),
  created_at timestamptz not null default now()
);

-- 9. RECURRING RULES & TEMPLATES
create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  template jsonb not null,
  frequency text not null default 'monthly' check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  day_of_month int check (day_of_month between 1 and 31),
  auto_create boolean not null default false,
  next_run date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  payload jsonb not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 10. AI INSIGHTS, AI MEMORY, GOOGLE SHEETS SYNC
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  period text not null,
  kind text not null default 'summary',
  content jsonb not null,
  feedback text check (feedback in ('up', 'down')),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_memory (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  patterns jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  feedback_log jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.sheets_sync (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  spreadsheet_id text not null default '',
  spreadsheet_url text not null default '',
  auto_sync boolean not null default false,
  last_synced_at timestamptz,
  status text not null default 'disconnected'
);

alter table public.sheets_sync add column if not exists spreadsheet_url text not null default '';
alter table public.sheets_sync add column if not exists auto_sync boolean not null default false;

-- 11. CALCULATED VIEWS
create or replace view public.wallet_balances
with (security_invoker = true) as
select
  w.id as wallet_id,
  w.owner_id,
  w.opening_balance
  + coalesce((
      select sum(
        case
          when t.type = 'income' and t.wallet_id = w.id then t.amount
          when t.type = 'expense' and t.wallet_id = w.id then -t.amount
          when t.type = 'adjustment' and t.wallet_id = w.id then t.amount
          when t.type in ('transfer', 'saving', 'saving_withdrawal') and t.wallet_id = w.id then -(t.amount + coalesce(t.fee, 0))
          when t.type in ('transfer', 'saving', 'saving_withdrawal') and t.to_wallet_id = w.id then t.amount
          else 0
        end
      )
      from public.transactions t
      where t.owner_id = w.owner_id
        and (t.wallet_id = w.id or t.to_wallet_id = w.id)
    ), 0) as balance
from public.wallets w;

-- 12. ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.goals enable row level security;
alter table public.goal_members enable row level security;
alter table public.goal_invites enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.investment_products enable row level security;
alter table public.transactions enable row level security;
alter table public.budget_periods enable row level security;
alter table public.wallet_valuations enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.templates enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_memory enable row level security;
alter table public.sheets_sync enable row level security;

drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "wallets_own" on public.wallets;
create policy "wallets_own" on public.wallets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "categories_own" on public.categories;
create policy "categories_own" on public.categories
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "subcategories_own" on public.subcategories;
create policy "subcategories_own" on public.subcategories
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "goals_own_or_shared" on public.goals;
create policy "goals_own_or_shared" on public.goals
  for select using (
    auth.uid() = owner_id
    or exists (select 1 from public.goal_members gm where gm.goal_id = id and gm.user_id = auth.uid())
  );

drop policy if exists "goals_mutate_own" on public.goals;
create policy "goals_mutate_own" on public.goals
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "goal_members_access" on public.goal_members;
create policy "goal_members_access" on public.goal_members
  for all using (
    auth.uid() = user_id
    or exists (select 1 from public.goals g where g.id = goal_id and g.owner_id = auth.uid())
  );

drop policy if exists "goal_invites_own" on public.goal_invites;
create policy "goal_invites_own" on public.goal_invites
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "goal_contributions_own" on public.goal_contributions;
create policy "goal_contributions_own" on public.goal_contributions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "investment_products_own" on public.investment_products;
create policy "investment_products_own" on public.investment_products
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "transactions_own" on public.transactions;
create policy "transactions_own" on public.transactions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "budget_periods_own" on public.budget_periods;
create policy "budget_periods_own" on public.budget_periods
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "wallet_valuations_own" on public.wallet_valuations;
create policy "wallet_valuations_own" on public.wallet_valuations
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "recurring_rules_own" on public.recurring_rules;
create policy "recurring_rules_own" on public.recurring_rules
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "templates_own" on public.templates;
create policy "templates_own" on public.templates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "ai_insights_own" on public.ai_insights;
create policy "ai_insights_own" on public.ai_insights
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "ai_memory_own" on public.ai_memory;
create policy "ai_memory_own" on public.ai_memory
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "sheets_sync_own" on public.sheets_sync;
create policy "sheets_sync_own" on public.sheets_sync
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Auto-create profile row when user signs up via Email or Google Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
