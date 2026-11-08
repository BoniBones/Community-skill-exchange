-- =============================================================================
-- Community Skill Exchange — Initial Relational Schema, RLS & Atomic RPCs
-- Target: Supabase (PostgreSQL 15+)
-- Timezone rule: all timestamps stored as TIMESTAMPTZ (UTC); presented/scheduled
-- in 'America/Argentina/Buenos_Aires'.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- -----------------------------------------------------------------------------
-- 1. Configuration & Reference Catalog
-- -----------------------------------------------------------------------------

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.neighborhoods (
  id text primary key,
  name text not null unique,
  centroid_lat double precision,
  centroid_lng double precision
);

create table if not exists public.skill_categories (
  id text primary key,
  name text not null unique,
  icon text not null,
  color text not null
);

create table if not exists public.skills (
  id text primary key,
  category_id text not null references public.skill_categories(id) on delete restrict,
  name text not null,
  unique (category_id, name)
);

-- -----------------------------------------------------------------------------
-- 2. Users, Public Profiles & Private Eligibility Records
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) >= 2),
  avatar_path text,
  neighborhood_id text not null references public.neighborhoods(id),
  bio text not null default '',
  availability_summary text not null default 'A coordinar',
  weekly_slots jsonb not null default '[]'::jsonb,
  status text not null default 'pending_eligibility'
    check (status in ('pending_eligibility', 'active', 'restricted', 'suspended')),
  role text not null default 'member'
    check (role in ('member', 'moderator', 'admin')),
  rating_avg numeric(3,2),
  rating_count integer not null default 0,
  completed_sessions integer not null default 0,
  community_contributions integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Strictly private table: birth date, parental consent, phone never exposed publicly
create table if not exists public.private_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date not null,
  accepted_safety_rules boolean not null default false,
  guardian_email text,
  guardian_consent_verified_at timestamptz,
  phone text,
  updated_at timestamptz not null default now()
);

-- Distinct entity #2: A skill a user possesses ('offers') or wants to learn ('wants')
create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id text not null references public.skills(id) on delete restrict,
  kind text not null check (kind in ('offers', 'wants')),
  level text check (level in ('beginner', 'intermediate', 'advanced', 'expert')),
  created_at timestamptz not null default now(),
  unique (user_id, skill_id, kind)
);

-- -----------------------------------------------------------------------------
-- 3. Activities, Flexible Payment Arrangements & Availability
-- -----------------------------------------------------------------------------

-- Distinct entity #3: An activity or service listing a user offers
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  skill_id text not null references public.skills(id) on delete restrict,
  title text not null check (char_length(trim(title)) >= 4),
  description text not null check (char_length(trim(description)) >= 10),
  duration_min integer not null check (duration_min between 15 and 240),
  format text not null check (format in ('in_person', 'online', 'either')),
  -- Public meeting place only; never a private home address
  meeting_area text not null check (char_length(trim(meeting_area)) >= 3),
  requirements text not null default 'Ninguno',
  availability_summary text not null default 'A coordinar',
  max_participants integer not null default 1 check (max_participants >= 1),
  status text not null default 'published'
    check (status in ('draft', 'published', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Three flexible payment arrangements chosen per activity by the instructor.
-- No universal fixed conversion rate between credits and ARS exists.
create table if not exists public.payment_arrangements (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  mode text not null check (mode in ('credits', 'money', 'mixed')),
  credit_amount numeric(6,2),
  money_amount_cents bigint,
  currency text not null default 'ARS' check (currency = 'ARS'),
  constraint payment_arrangement_mode_check check (
    (mode = 'credits' and credit_amount > 0 and money_amount_cents is null) or
    (mode = 'money' and money_amount_cents > 0 and credit_amount is null) or
    (mode = 'mixed' and credit_amount > 0 and money_amount_cents > 0)
  )
);

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  timezone text not null default 'America/Argentina/Buenos_Aires'
);

-- -----------------------------------------------------------------------------
-- 4. Sessions, Audit Trail & Two-Stage QR Verification Tokens
-- -----------------------------------------------------------------------------

-- Distinct entity #4: A session resulting from a booking
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete restrict,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  state text not null default 'requested' check (
    state in (
      'requested',
      'confirmed',
      'declined',
      'expired',
      'cancelled',
      'in_progress',
      'no_show_pending',
      'completed',
      'disputed',
      'resolved'
    )
  ),
  -- Immutable price snapshot copied at booking time
  price_mode text not null check (price_mode in ('credits', 'money', 'mixed')),
  price_credit_amount numeric(6,2),
  price_money_cents bigint,
  price_currency text not null default 'ARS',
  learner_note text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (learner_id <> instructor_id)
);

create table if not exists public.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  from_state text,
  to_state text not null,
  actor_id uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.session_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  phase text not null check (phase in ('check_in', 'check_out')),
  issuer_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. Closed-Loop Credit Ledger & Separate Monetary Payment Records
-- -----------------------------------------------------------------------------

create table if not exists public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('user', 'escrow', 'incentive_pool', 'adjustments')),
  balance numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  -- User accounts cannot go negative
  constraint non_negative_user_balance check (kind <> 'user' or balance >= 0)
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  from_account uuid not null references public.credit_accounts(id),
  to_account uuid not null references public.credit_accounts(id),
  amount numeric(10,2) not null check (amount > 0),
  type text not null check (type in ('incentive', 'hold', 'release', 'refund', 'penalty', 'adjustment')),
  session_id uuid references public.sessions(id),
  idempotency_key text not null unique,
  memo text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (from_account <> to_account)
);

-- Strictly separated from credit_transactions for auditing and future payment gateways
create table if not exists public.monetary_payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete restrict,
  payer_id uuid not null references public.profiles(id),
  payee_id uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ARS',
  method text not null default 'cash_or_transfer'
    check (method in ('cash_or_transfer', 'mercadopago')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed_by_payee', 'disputed', 'refunded')),
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 6. Reviews, Disputes, Reports, Blocks & Notifications
-- -----------------------------------------------------------------------------

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  subject_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (session_id, author_id),
  check (author_id <> subject_id)
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'resolved_refund', 'resolved_release', 'resolved_split')),
  resolution_note text,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete cascade,
  target_activity_id uuid references public.activities(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 7. Row-Level Security (RLS)
-- -----------------------------------------------------------------------------

alter table public.neighborhoods enable row level security;
alter table public.skill_categories enable row level security;
alter table public.skills enable row level security;
alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.user_skills enable row level security;
alter table public.activities enable row level security;
alter table public.payment_arrangements enable row level security;
alter table public.availability_slots enable row level security;
alter table public.sessions enable row level security;
alter table public.session_events enable row level security;
alter table public.session_verification_tokens enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.monetary_payments enable row level security;
alter table public.reviews enable row level security;
alter table public.disputes enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;

-- Public catalog read policies
create policy "Public read neighborhoods" on public.neighborhoods for select using (true);
create policy "Public read categories" on public.skill_categories for select using (true);
create policy "Public read skills" on public.skills for select using (true);

-- Profiles: public read (excluding blocked pairs), owner update
create policy "Read active profiles" on public.profiles for select using (true);
create policy "Owner update profile" on public.profiles for update using (auth.uid() = id);

-- Private profiles: strictly owner only
create policy "Owner read private profile" on public.private_profiles for select using (auth.uid() = user_id);
create policy "Owner upsert private profile" on public.private_profiles for all using (auth.uid() = user_id);

-- User skills: public read, owner manage
create policy "Public read user skills" on public.user_skills for select using (true);
create policy "Owner manage user skills" on public.user_skills for all using (auth.uid() = user_id);

-- Activities & payment arrangements: public read published, instructor manage own
create policy "Read published activities" on public.activities
  for select using (status = 'published' or auth.uid() = instructor_id);
create policy "Instructor manage activities" on public.activities
  for all using (auth.uid() = instructor_id);

create policy "Read payment arrangements" on public.payment_arrangements for select using (true);
create policy "Instructor manage payment arrangements" on public.payment_arrangements
  for all using (
    exists (
      select 1 from public.activities a
      where a.id = payment_arrangements.activity_id and a.instructor_id = auth.uid()
    )
  );

-- Sessions: only learner or instructor can read; mutations happen via atomic RPCs
create policy "Participant read session" on public.sessions
  for select using (auth.uid() = learner_id or auth.uid() = instructor_id);

-- Credit accounts & transactions: strictly read-only for account owner; NO direct client writes
create policy "Owner read credit account" on public.credit_accounts
  for select using (auth.uid() = owner_id);

create policy "Owner read credit transactions" on public.credit_transactions
  for select using (
    exists (
      select 1 from public.credit_accounts ca
      where (ca.id = credit_transactions.from_account or ca.id = credit_transactions.to_account)
        and ca.owner_id = auth.uid()
    )
  );

-- Reviews: public read; insert only for completed sessions by participant
create policy "Public read reviews" on public.reviews for select using (true);
create policy "Participant insert verified review" on public.reviews
  for insert with check (
    auth.uid() = author_id and
    exists (
      select 1 from public.sessions s
      where s.id = reviews.session_id
        and s.state = 'completed'
        and (s.learner_id = auth.uid() or s.instructor_id = auth.uid())
    )
  );

-- Reports & blocks: owner manage
create policy "Owner manage blocks" on public.blocks for all using (auth.uid() = blocker_id);
create policy "Owner insert reports" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "Owner read notifications" on public.notifications for select using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 8. Atomic Ledger & Session Lifecycle Functions (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

create or replace function public.ledger_transfer(
  p_from uuid,
  p_to uuid,
  p_amount numeric,
  p_type text,
  p_session_id uuid,
  p_idempotency_key text,
  p_memo text,
  p_actor uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_from_kind text;
  v_from_balance numeric;
  v_tx_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Transfer amount must be positive';
  end if;

  -- Idempotency check
  select id into v_existing_id
  from public.credit_transactions
  where idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  -- Lock both accounts in deterministic UUID order to prevent deadlocks
  perform 1
  from public.credit_accounts
  where id in (p_from, p_to)
  order by id
  for update;

  select kind, balance into v_from_kind, v_from_balance
  from public.credit_accounts
  where id = p_from;

  if v_from_kind = 'user' and v_from_balance < p_amount then
    raise exception 'Insufficient available community credits (available: %, required: %)', v_from_balance, p_amount;
  end if;

  update public.credit_accounts
  set balance = balance - p_amount, updated_at = now()
  where id = p_from;

  update public.credit_accounts
  set balance = balance + p_amount, updated_at = now()
  where id = p_to;

  insert into public.credit_transactions (
    from_account, to_account, amount, type, session_id, idempotency_key, memo, created_by
  ) values (
    p_from, p_to, p_amount, p_type, p_session_id, p_idempotency_key, p_memo, p_actor
  ) returning id into v_tx_id;

  return v_tx_id;
end;
$$;

revoke all on function public.ledger_transfer(uuid, uuid, numeric, text, uuid, text, text, uuid) from public, anon, authenticated;
