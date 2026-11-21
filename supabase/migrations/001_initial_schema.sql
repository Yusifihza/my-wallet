-- My Wallet — Initial PostgreSQL Schema (Supabase)
-- Covers Phase 1 MVP + tables prepared for Phase 2 (Sharing, Valuations, Sheets Sync) & Phase 3 (AI Memory)

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

-- 4. GOALS & SHARED GOAL MEMBERS
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

-- 5. TRANSACTIONS
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
  note text not null default '',
  recurring_rule_id uuid,
  created_at timestamptz not null default now(),
  constraint amount_check check (
    (type = 'adjustment' and amount <> 0) or (type <> 'adjustment' and amount > 0)
  )
);

create index if not exists idx_transactions_owner_date on public.transactions(owner_id, date desc);
create index if not exists idx_transactions_wallet on public.transactions(wallet_id);
create index if not exists idx_transactions_to_wallet on public.transactions(to_wallet_id);
create index if not exists idx_transactions_goal on public.transactions(goal_id);

-- 6. BUDGET PERIODS (historical monthly snapshots)
create table if not exists public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  month text not null, -- YYYY-MM
  category_id uuid references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete cascade,
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now()
);

-- 7. WALLET VALUATIONS (Bibit market value snapshots - Phase 2)
create table if not exists public.wallet_valuations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  date date not null default current_date,
  market_value bigint not null check (market_value >= 0),
  created_at timestamptz not null default now()
);

-- 8. RECURRING RULES & TEMPLATES
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

-- 9. AI INSIGHTS, AI MEMORY, GOOGLE SHEETS SYNC (Phase 2 & 3)
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
  spreadsheet_id text,
  last_synced_at timestamptz,
  status text not null default 'disconnected'
);

-- 10. CALCULATED VIEWS
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

-- 11. ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.goals enable row level security;
alter table public.goal_members enable row level security;
alter table public.transactions enable row level security;
alter table public.budget_periods enable row level security;
alter table public.wallet_valuations enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.templates enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_memory enable row level security;
alter table public.sheets_sync enable row level security;

create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "wallets_own" on public.wallets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "categories_own" on public.categories
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "subcategories_own" on public.subcategories
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "goals_own_or_shared" on public.goals
  for select using (
    auth.uid() = owner_id
    or exists (select 1 from public.goal_members gm where gm.goal_id = id and gm.user_id = auth.uid())
  );

create policy "goals_mutate_own" on public.goals
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "goal_members_access" on public.goal_members
  for all using (
    auth.uid() = user_id
    or exists (select 1 from public.goals g where g.id = goal_id and g.owner_id = auth.uid())
  );

create policy "transactions_own" on public.transactions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "budget_periods_own" on public.budget_periods
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "wallet_valuations_own" on public.wallet_valuations
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "recurring_rules_own" on public.recurring_rules
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "templates_own" on public.templates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "ai_insights_own" on public.ai_insights
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "ai_memory_own" on public.ai_memory
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "sheets_sync_own" on public.sheets_sync
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Auto-create profile row when user signs up via Google Auth
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
