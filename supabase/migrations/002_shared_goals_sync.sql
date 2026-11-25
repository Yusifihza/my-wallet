-- ============================================================================
-- My Wallet — Migration 002: Multi-Account Shared Goals Sync (Partner Mode)
-- Aman dijalankan ulang (idempotent). Copy seluruh isi file ini ke
-- Supabase -> SQL Editor -> New query -> Run.
-- ============================================================================

-- 1. Track contributor user id on goal_contributions
alter table public.goal_contributions
  add column if not exists contributor_user_id uuid references public.profiles(id) on delete set null;

-- Backfill unique invite codes if legacy placeholder 'MW-WED-2027' exists on multiple accounts
update public.goal_invites
set code = 'MW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
  || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 5, 2))
where upper(trim(code)) = 'MW-WED-2027';

-- Normalize existing codes to uppercase trimmed
update public.goal_invites
set code = upper(trim(code))
where code <> upper(trim(code));

-- Ensure no colliding codes exist before creating unique index
with ranked as (
  select
    goal_id,
    row_number() over (partition by upper(code) order by created_at asc, goal_id asc) as rn
  from public.goal_invites
)
update public.goal_invites gi
set code = 'MW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
  || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 5, 2))
from ranked r
where gi.goal_id = r.goal_id and r.rn > 1;

create unique index if not exists idx_goal_invites_code_upper
  on public.goal_invites (upper(code));

-- 2. Non-recursive SECURITY DEFINER access helpers (prevents Postgres RLS infinite recursion)
create or replace function public.is_goal_owner(p_goal_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.goals g
    where g.id = p_goal_id and g.owner_id = p_user_id
  );
$$;

create or replace function public.is_goal_member(p_goal_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.goal_members gm
    where gm.goal_id = p_goal_id and gm.user_id = p_user_id
  );
$$;

create or replace function public.can_access_goal(p_goal_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_goal_owner(p_goal_id, p_user_id)
      or public.is_goal_member(p_goal_id, p_user_id);
$$;

-- 3. Update RLS policies so ONLY shared goal data is visible between owner & joined partner
--    (Personal wallets, transactions, budgets, categories remain 100% private!)

-- goals
drop policy if exists "goals_own_or_shared" on public.goals;
drop policy if exists "goals_mutate_own" on public.goals;
drop policy if exists "goals_select_shared" on public.goals;
drop policy if exists "goals_insert_own" on public.goals;
drop policy if exists "goals_update_own" on public.goals;
drop policy if exists "goals_delete_own" on public.goals;

create policy "goals_select_shared" on public.goals
  for select using (
    auth.uid() = owner_id
    or public.is_goal_member(id, auth.uid())
  );

create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = owner_id);

create policy "goals_update_own" on public.goals
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = owner_id);

-- goal_members
drop policy if exists "goal_members_access" on public.goal_members;
drop policy if exists "goal_members_select" on public.goal_members;
drop policy if exists "goal_members_delete" on public.goal_members;

create policy "goal_members_select" on public.goal_members
  for select using (
    auth.uid() = user_id
    or public.is_goal_owner(goal_id, auth.uid())
  );

create policy "goal_members_delete" on public.goal_members
  for delete using (
    auth.uid() = user_id
    or public.is_goal_owner(goal_id, auth.uid())
  );

-- goal_invites
drop policy if exists "goal_invites_own" on public.goal_invites;
drop policy if exists "goal_invites_select" on public.goal_invites;
drop policy if exists "goal_invites_insert_own" on public.goal_invites;
drop policy if exists "goal_invites_update_own" on public.goal_invites;
drop policy if exists "goal_invites_delete_own" on public.goal_invites;

create policy "goal_invites_select" on public.goal_invites
  for select using (
    auth.uid() = owner_id
    or public.is_goal_member(goal_id, auth.uid())
  );

create policy "goal_invites_insert_own" on public.goal_invites
  for insert with check (auth.uid() = owner_id);

create policy "goal_invites_update_own" on public.goal_invites
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "goal_invites_delete_own" on public.goal_invites
  for delete using (auth.uid() = owner_id);

-- goal_contributions
drop policy if exists "goal_contributions_own" on public.goal_contributions;
drop policy if exists "goal_contributions_select" on public.goal_contributions;
drop policy if exists "goal_contributions_insert" on public.goal_contributions;
drop policy if exists "goal_contributions_delete" on public.goal_contributions;

create policy "goal_contributions_select" on public.goal_contributions
  for select using (public.can_access_goal(goal_id, auth.uid()));

create policy "goal_contributions_insert" on public.goal_contributions
  for insert with check (
    auth.uid() = owner_id
    and public.can_access_goal(goal_id, auth.uid())
  );

create policy "goal_contributions_delete" on public.goal_contributions
  for delete using (
    auth.uid() = owner_id
    or auth.uid() = contributor_user_id
    or public.is_goal_owner(goal_id, auth.uid())
  );

-- investment_products: personal products stay private; products linked to a shared goal are readable by joined partner
drop policy if exists "investment_products_own" on public.investment_products;
drop policy if exists "investment_products_select" on public.investment_products;
drop policy if exists "investment_products_insert_own" on public.investment_products;
drop policy if exists "investment_products_update_own" on public.investment_products;
drop policy if exists "investment_products_delete_own" on public.investment_products;

create policy "investment_products_select" on public.investment_products
  for select using (
    auth.uid() = owner_id
    or (goal_id is not null and public.can_access_goal(goal_id, auth.uid()))
  );

create policy "investment_products_insert_own" on public.investment_products
  for insert with check (auth.uid() = owner_id);

create policy "investment_products_update_own" on public.investment_products
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "investment_products_delete_own" on public.investment_products
  for delete using (auth.uid() = owner_id);

-- 4. RPC: Partner joins a shared goal using invite code
create or replace function public.join_shared_goal(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := upper(trim(coalesce(p_code, '')));
  v_inv record;
  v_goal record;
  v_owner_name text;
  v_caller_name text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Silakan masuk ke akunmu terlebih dahulu.');
  end if;

  if v_clean = '' then
    return jsonb_build_object('ok', false, 'error', 'Masukkan kode undangan dari pasanganmu.');
  end if;

  select * into v_inv
  from public.goal_invites
  where upper(trim(code)) = v_clean
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Kode undangan tidak ditemukan. Pastikan kode sudah benar dan sudah disimpan oleh pasanganmu.');
  end if;

  select * into v_goal
  from public.goals
  where id = v_inv.goal_id;

  if not found or not v_goal.is_shared then
    return jsonb_build_object('ok', false, 'error', 'Goal ini belum diaktifkan sebagai goal bersama.');
  end if;

  if v_goal.owner_id = v_uid then
    return jsonb_build_object('ok', false, 'error', 'Kamu adalah pemilik goal ini sendiri. Bagikan kode ini ke akun pasanganmu.');
  end if;

  select display_name into v_owner_name from public.profiles where id = v_goal.owner_id;
  select display_name into v_caller_name from public.profiles where id = v_uid;

  insert into public.goal_members (goal_id, user_id, role, share_percent)
  values (v_goal.id, v_uid, 'member', coalesce(v_inv.share_percent, 50))
  on conflict (goal_id, user_id) do update
    set share_percent = excluded.share_percent;

  update public.goal_invites
  set
    status = 'joined',
    partner_name = case
      when trim(coalesce(partner_name, '')) in ('', 'Pasangan') and coalesce(v_caller_name, '') <> ''
        then v_caller_name
      else partner_name
    end
  where goal_id = v_goal.id;

  return jsonb_build_object(
    'ok', true,
    'goal_id', v_goal.id,
    'goal_name', v_goal.name,
    'owner_name', coalesce(v_owner_name, 'Pasangan')
  );
end;
$$;

-- 5. RPC: Partner leaves a shared goal
create or replace function public.leave_shared_goal(p_goal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_remaining int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Belum login.');
  end if;

  delete from public.goal_members
  where goal_id = p_goal_id and user_id = v_uid;

  select count(*) into v_remaining
  from public.goal_members
  where goal_id = p_goal_id;

  if v_remaining = 0 then
    update public.goal_invites
    set status = 'pending'
    where goal_id = p_goal_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 6. RPC: Safe peer display-name lookup ONLY for accessible shared goals
create or replace function public.get_shared_goal_peers(p_goal_ids uuid[])
returns table (
  goal_id uuid,
  owner_id uuid,
  owner_name text,
  member_user_id uuid,
  member_name text,
  share_percent int
)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id as goal_id,
    g.owner_id,
    coalesce(nullif(trim(po.display_name), ''), 'Pemilik') as owner_name,
    gm.user_id as member_user_id,
    coalesce(nullif(trim(pm.display_name), ''), nullif(trim(gi.partner_name), ''), 'Pasangan') as member_name,
    coalesce(gm.share_percent, gi.share_percent, 50) as share_percent
  from public.goals g
  left join public.profiles po on po.id = g.owner_id
  left join public.goal_members gm on gm.goal_id = g.id
  left join public.profiles pm on pm.id = gm.user_id
  left join public.goal_invites gi on gi.goal_id = g.id
  where g.id = any(p_goal_ids)
    and public.can_access_goal(g.id, auth.uid());
$$;

-- 7. RPC: Safe aggregate of non-Bibit saving transactions per goal & user
--    (Keeps raw transactions, notes, and personal wallets 100% private!)
create or replace function public.get_shared_goal_tx_totals(p_goal_ids uuid[])
returns table (
  goal_id uuid,
  user_id uuid,
  tx_saved bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    t.goal_id,
    t.owner_id as user_id,
    coalesce(sum(
      case
        when t.type = 'saving' then t.amount
        when t.type = 'saving_withdrawal' then -t.amount
        else 0
      end
    ), 0)::bigint as tx_saved
  from public.transactions t
  where t.goal_id = any(p_goal_ids)
    and public.can_access_goal(t.goal_id, auth.uid())
    and (
      t.investment_product_id is null
      or not exists (
        select 1 from public.investment_products ip
        where ip.id = t.investment_product_id
          and ip.goal_id = t.goal_id
          and (ip.market_value > 0 or ip.invested_amount > 0)
      )
    )
  group by t.goal_id, t.owner_id;
$$;

grant execute on function public.is_goal_owner(uuid, uuid) to authenticated;
grant execute on function public.is_goal_member(uuid, uuid) to authenticated;
grant execute on function public.can_access_goal(uuid, uuid) to authenticated;
grant execute on function public.join_shared_goal(text) to authenticated;
grant execute on function public.leave_shared_goal(uuid) to authenticated;
grant execute on function public.get_shared_goal_peers(uuid[]) to authenticated;
grant execute on function public.get_shared_goal_tx_totals(uuid[]) to authenticated;
