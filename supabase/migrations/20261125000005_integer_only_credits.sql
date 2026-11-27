-- =============================================================================
-- Community Skill Exchange — CSE-M1 Integer-Only Non-Cashable Credits Migration
-- Eliminates real-money payments (monetary_payments, ARS, money/mixed modes),
-- removes fractional credit decimals & 50/50 split disputes, and enforces
-- integer >= 1 non-cashable time-credits (1h = 1 credit) across schema & RPCs.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Drop Monetary Payment RPCs & Table
-- -----------------------------------------------------------------------------

drop function if exists public.report_monetary_payment(uuid, text, text);
drop function if exists public.confirm_monetary_payment(uuid);
drop table if exists public.monetary_payments cascade;

-- -----------------------------------------------------------------------------
-- 2. Normalize & Convert payment_arrangements to Integer Non-Cashable Credits
-- -----------------------------------------------------------------------------

alter table public.payment_arrangements
  drop constraint if exists payment_arrangement_mode_check,
  drop constraint if exists payment_arrangements_mode_check,
  drop constraint if exists payment_arrangements_currency_check,
  drop constraint if exists payment_arrangements_credit_amount_check,
  drop constraint if exists payment_arrangements_non_cashable_check,
  drop column if exists mode,
  drop column if exists money_amount_cents,
  drop column if exists currency;

alter table public.payment_arrangements
  alter column credit_amount type integer using greatest(1, round(coalesce(credit_amount, 1)))::integer,
  alter column credit_amount set default 1,
  alter column credit_amount set not null,
  add column if not exists is_non_cashable boolean not null default true,
  add constraint payment_arrangements_credit_amount_check check (credit_amount >= 1),
  add constraint payment_arrangements_non_cashable_check check (is_non_cashable = true);

-- -----------------------------------------------------------------------------
-- 3. Normalize & Convert sessions Price Snapshot to Integer Credits Only
-- -----------------------------------------------------------------------------

alter table public.sessions
  drop constraint if exists sessions_price_mode_check,
  drop constraint if exists sessions_price_credit_amount_check,
  drop column if exists price_mode,
  drop column if exists price_money_cents,
  drop column if exists price_currency;

alter table public.sessions
  alter column price_credit_amount type integer using greatest(1, round(coalesce(price_credit_amount, 1)))::integer,
  alter column price_credit_amount set default 1,
  alter column price_credit_amount set not null,
  add constraint sessions_price_credit_amount_check check (price_credit_amount >= 1);

-- -----------------------------------------------------------------------------
-- 4. Convert credit_accounts.balance & credit_transactions.amount to Integer
-- -----------------------------------------------------------------------------

alter table public.credit_accounts
  alter column balance type integer using round(balance)::integer,
  alter column balance set default 0,
  alter column balance set not null;

alter table public.credit_transactions
  drop constraint if exists credit_transactions_amount_check,
  alter column amount type integer using greatest(1, round(amount))::integer,
  alter column amount set not null,
  add constraint credit_transactions_amount_check check (amount >= 1);

-- -----------------------------------------------------------------------------
-- 5. Remove Fractional 'resolved_split' from disputes
-- -----------------------------------------------------------------------------

update public.disputes
set status = 'resolved_refund',
    resolution_note = trim(coalesce(resolution_note, '') || ' [migrated to full refund for integer-only credits]')
where status = 'resolved_split';

alter table public.disputes
  drop constraint if exists disputes_status_check,
  add constraint disputes_status_check
    check (status in ('open', 'resolved_refund', 'resolved_release'));

-- -----------------------------------------------------------------------------
-- 6. Replace Ledger & Transactional RPCs with Integer-Only Signatures/Bodies
-- -----------------------------------------------------------------------------

-- Drop old numeric signature so no overload remains
drop function if exists public.ledger_transfer(uuid, uuid, numeric, text, uuid, text, text, uuid);

create or replace function public.ledger_transfer(
  p_from uuid,
  p_to uuid,
  p_amount integer,
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
  v_from_balance integer;
  v_tx_id uuid;
begin
  if p_amount is null or p_amount < 1 then
    raise exception 'Transfer amount must be an integer >= 1';
  end if;

  select id into v_existing_id
  from public.credit_transactions
  where idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

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

revoke all on function public.ledger_transfer(uuid, uuid, integer, text, uuid, text, text, uuid) from public, anon, authenticated;

-- Drop old 13-arg signature with p_payment_mode / p_money_amount_cents
drop function if exists public.publish_activity_with_arrangement(
  uuid, text, text, text, integer, text, text, text, text, text, text, numeric, bigint
);

create or replace function public.publish_activity_with_arrangement(
  p_activity_id uuid,
  p_skill_id text,
  p_title text,
  p_description text,
  p_duration_min integer,
  p_format text,
  p_meeting_area text,
  p_requirements text,
  p_availability_summary text,
  p_status text,
  p_credit_amount integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_user_account uuid;
  v_incentive_amount integer := 2;
  v_already_incentivized boolean;
  v_granted_incentive boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_credit_amount is null or p_credit_amount < 1 then
    raise exception 'Credit amount must be an integer >= 1';
  end if;

  if p_activity_id is not null then
    update public.activities
    set skill_id = p_skill_id,
        title = trim(p_title),
        description = trim(p_description),
        duration_min = p_duration_min,
        format = p_format,
        meeting_area = trim(p_meeting_area),
        requirements = coalesce(nullif(trim(p_requirements), ''), 'Ninguno'),
        availability_summary = coalesce(nullif(trim(p_availability_summary), ''), 'A coordinar'),
        status = p_status,
        updated_at = now()
    where id = p_activity_id and instructor_id = v_uid
    returning id into v_id;

    if v_id is null then
      raise exception 'Activity not found or unauthorized';
    end if;
  else
    insert into public.activities (
      instructor_id, skill_id, title, description, duration_min,
      format, meeting_area, requirements, availability_summary, status
    ) values (
      v_uid, p_skill_id, trim(p_title), trim(p_description), p_duration_min,
      p_format, trim(p_meeting_area),
      coalesce(nullif(trim(p_requirements), ''), 'Ninguno'),
      coalesce(nullif(trim(p_availability_summary), ''), 'A coordinar'),
      p_status
    ) returning id into v_id;
  end if;

  insert into public.payment_arrangements (
    activity_id, credit_amount, is_non_cashable
  ) values (
    v_id, p_credit_amount, true
  )
  on conflict (activity_id) do update set
    credit_amount = excluded.credit_amount,
    is_non_cashable = true;

  insert into public.user_skills (user_id, skill_id, kind, level)
  values (v_uid, p_skill_id, 'offers', 'advanced')
  on conflict (user_id, skill_id, kind) do nothing;

  if p_status = 'published' then
    select exists (
      select 1 from public.credit_transactions
      where idempotency_key = 'incentive:' || v_uid::text
    ) into v_already_incentivized;

    if not v_already_incentivized then
      v_user_account := public.ensure_user_credit_account(v_uid);
      perform public.ledger_transfer(
        '00000000-0000-0000-0000-000000000002'::uuid,
        v_user_account,
        v_incentive_amount,
        'incentive',
        null,
        'incentive:' || v_uid::text,
        'Incentivo de participación: publicaste tu primera actividad en la comunidad',
        v_uid
      );
      v_granted_incentive := true;
    end if;
  end if;

  return jsonb_build_object(
    'activity_id', v_id,
    'granted_incentive', v_granted_incentive
  );
end;
$$;

create or replace function public.book_session(
  p_activity_id uuid,
  p_starts_at timestamptz,
  p_learner_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_act record;
  v_credit_amount integer;
  v_session_id uuid;
  v_learner_account uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_act
  from public.activities
  where id = p_activity_id and status = 'published';

  if v_act is null then
    raise exception 'Activity not available';
  end if;

  if v_act.instructor_id = v_uid then
    raise exception 'Cannot book your own activity';
  end if;

  select pa.credit_amount into v_credit_amount
  from public.payment_arrangements pa
  where pa.activity_id = p_activity_id;

  v_credit_amount := coalesce(v_credit_amount, 1);
  if v_credit_amount < 1 then
    raise exception 'Activity credit amount must be an integer >= 1';
  end if;

  insert into public.sessions (
    activity_id, learner_id, instructor_id, starts_at, ends_at, state,
    price_credit_amount, learner_note
  ) values (
    p_activity_id,
    v_uid,
    v_act.instructor_id,
    p_starts_at,
    p_starts_at + make_interval(mins => v_act.duration_min),
    'requested',
    v_credit_amount,
    nullif(trim(coalesce(p_learner_note, '')), '')
  ) returning id into v_session_id;

  insert into public.session_events (session_id, from_state, to_state, actor_id, reason)
  values (v_session_id, null, 'requested', v_uid, 'Booking requested by learner');

  v_learner_account := public.ensure_user_credit_account(v_uid);
  perform public.ledger_transfer(
    v_learner_account,
    '00000000-0000-0000-0000-000000000001'::uuid,
    v_credit_amount,
    'hold',
    v_session_id,
    'hold:' || v_session_id::text,
    v_act.title || ': retenido en custodia hasta completar la sesión',
    v_uid
  );

  return v_session_id;
end;
$$;

create or replace function public.respond_to_session(
  p_session_id uuid,
  p_decision text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ses record;
  v_learner_account uuid;
  v_next_state text;
begin
  select * into v_ses
  from public.sessions
  where id = p_session_id
  for update;

  if v_ses is null then
    raise exception 'Session not found';
  end if;

  if v_ses.instructor_id <> v_uid then
    raise exception 'Only the instructor can confirm or decline this session';
  end if;

  if v_ses.state <> 'requested' then
    raise exception 'Session is not in requested state';
  end if;

  if p_decision = 'confirm' then
    v_next_state := 'confirmed';
  elsif p_decision = 'decline' then
    v_next_state := 'declined';
    v_learner_account := public.ensure_user_credit_account(v_ses.learner_id);
    perform public.ledger_transfer(
      '00000000-0000-0000-0000-000000000001'::uuid,
      v_learner_account,
      v_ses.price_credit_amount,
      'refund',
      v_ses.id,
      'refund:' || v_ses.id::text,
      'Reintegro: solicitud rechazada por el instructor',
      v_uid
    );
  else
    raise exception 'Invalid decision';
  end if;

  update public.sessions
  set state = v_next_state, updated_at = now()
  where id = p_session_id;

  insert into public.session_events (session_id, from_state, to_state, actor_id)
  values (p_session_id, 'requested', v_next_state, v_uid);

  return v_next_state;
end;
$$;

create or replace function public.cancel_session(
  p_session_id uuid,
  p_reason text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ses record;
  v_learner_account uuid;
  v_hours_before double precision;
  v_is_timely boolean;
  v_refunded boolean := false;
  v_review_ends timestamptz;
begin
  select * into v_ses
  from public.sessions
  where id = p_session_id
  for update;

  if v_ses is null then
    raise exception 'Session not found';
  end if;

  if v_ses.learner_id <> v_uid and v_ses.instructor_id <> v_uid then
    raise exception 'Not a participant of this session';
  end if;

  if v_ses.state not in ('requested', 'confirmed') then
    raise exception 'Only requested or confirmed sessions can be cancelled';
  end if;

  v_hours_before := extract(epoch from (v_ses.starts_at - now())) / 3600.0;
  v_is_timely := (v_uid = v_ses.instructor_id) or (v_hours_before >= 24);
  v_review_ends := case when v_is_timely then null else now() + interval '48 hours' end;

  update public.sessions
  set state = 'cancelled',
      cancellation_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelada por participante'),
      cancellation_timing = case when v_is_timely then 'timely' else 'late_review_window' end,
      review_window_ends_at = v_review_ends,
      updated_at = now()
  where id = p_session_id;

  insert into public.session_events (session_id, from_state, to_state, actor_id, reason)
  values (p_session_id, v_ses.state, 'cancelled', v_uid, p_reason);

  if v_is_timely then
    v_learner_account := public.ensure_user_credit_account(v_ses.learner_id);
    perform public.ledger_transfer(
      '00000000-0000-0000-0000-000000000001'::uuid,
      v_learner_account,
      v_ses.price_credit_amount,
      'refund',
      v_ses.id,
      'refund:' || v_ses.id::text,
      case when v_uid = v_ses.instructor_id
        then 'Reintegro total: el instructor canceló la sesión'
        else 'Reintegro total: cancelación con más de 24 h de anticipación'
      end,
      v_uid
    );
    v_refunded := true;
  end if;

  return jsonb_build_object(
    'session_id', p_session_id,
    'state', 'cancelled',
    'cancellation_timing', case when v_is_timely then 'timely' else 'late_review_window' end,
    'review_window_ends_at', v_review_ends,
    'refunded', v_refunded
  );
end;
$$;

create or replace function public.redeem_session_token(
  p_session_id uuid,
  p_phase text,
  p_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ses record;
  v_tok record;
  v_hash text;
  v_instructor_account uuid;
  v_released integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ses
  from public.sessions
  where id = p_session_id
  for update;

  if v_ses is null then
    raise exception 'Session not found';
  end if;

  if v_ses.learner_id <> v_uid and v_ses.instructor_id <> v_uid then
    raise exception 'Not a participant of this session';
  end if;

  v_hash := encode(digest(p_session_id::text || ':' || p_phase || ':' || upper(trim(coalesce(p_code, ''))), 'sha256'), 'hex');

  select * into v_tok
  from public.session_verification_tokens
  where session_id = p_session_id
    and phase = p_phase
    and token_hash = v_hash
    and used_at is null
  for update;

  if v_tok is null then
    raise exception 'Invalid or already used verification code';
  end if;

  if v_tok.expires_at < now() then
    raise exception 'Verification token expired (90s limit). Please issue a new QR code.';
  end if;

  if v_tok.issuer_id = v_uid then
    raise exception 'Counterpart must scan or redeem the verification token';
  end if;

  update public.session_verification_tokens
  set used_at = now(),
      used_by = v_uid
  where id = v_tok.id;

  if p_phase = 'check_in' then
    if v_ses.state <> 'confirmed' then
      raise exception 'Session must be confirmed before check-in';
    end if;

    update public.sessions
    set state = 'in_progress',
        checked_in_at = now(),
        updated_at = now()
    where id = p_session_id;

    insert into public.session_events (session_id, from_state, to_state, actor_id, reason)
    values (p_session_id, 'confirmed', 'in_progress', v_uid, 'Stage 1 QR check-in verified');

    return jsonb_build_object(
      'session_id', p_session_id,
      'state', 'in_progress',
      'released_credits', 0
    );
  end if;

  if v_ses.state <> 'in_progress' then
    raise exception 'Session must be in_progress before check-out';
  end if;

  update public.sessions
  set state = 'completed',
      checked_out_at = now(),
      updated_at = now()
  where id = p_session_id;

  insert into public.session_events (session_id, from_state, to_state, actor_id, reason)
  values (p_session_id, 'in_progress', 'completed', v_uid, 'Stage 2 QR check-out verified');

  v_instructor_account := public.ensure_user_credit_account(v_ses.instructor_id);
  perform public.ledger_transfer(
    '00000000-0000-0000-0000-000000000001'::uuid,
    v_instructor_account,
    v_ses.price_credit_amount,
    'release',
    v_ses.id,
    'release:' || v_ses.id::text,
    'Liberación atómica de custodia tras verificación QR en 2 etapas',
    v_uid
  );
  v_released := v_ses.price_credit_amount;

  update public.profiles
  set completed_sessions = completed_sessions + 1,
      community_contributions = community_contributions + 1,
      updated_at = now()
  where id in (v_ses.learner_id, v_ses.instructor_id);

  insert into public.notifications (user_id, type, title, body, payload)
  values
    (
      v_ses.instructor_id,
      'credit_released',
      'Sesión verificada y créditos acreditados',
      'Se completó la verificación QR de cierre y se liberaron los créditos en custodia.',
      jsonb_build_object('session_id', v_ses.id, 'released_credits', v_released)
    ),
    (
      v_ses.learner_id,
      'session_completed',
      'Sesión completada',
      '¡Gracias por participar! Ya podés dejar tu reseña verificada.',
      jsonb_build_object('session_id', v_ses.id)
    );

  return jsonb_build_object(
    'session_id', p_session_id,
    'state', 'completed',
    'released_credits', v_released
  );
end;
$$;

create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_resolution text,
  p_resolution_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_disp record;
  v_ses record;
  v_learner_account uuid;
  v_instructor_account uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select role into v_role
  from public.profiles
  where id = v_uid;

  if v_role not in ('moderator', 'admin') then
    raise exception 'Moderator or admin role required to resolve disputes';
  end if;

  if p_resolution not in ('resolved_refund', 'resolved_release') then
    raise exception 'Invalid dispute resolution (%)', p_resolution;
  end if;

  select * into v_disp
  from public.disputes
  where id = p_dispute_id
  for update;

  if v_disp is null or v_disp.status <> 'open' then
    raise exception 'Open dispute not found';
  end if;

  select * into v_ses
  from public.sessions
  where id = v_disp.session_id
  for update;

  update public.disputes
  set status = p_resolution,
      resolution_note = trim(coalesce(p_resolution_note, '')),
      resolved_by = v_uid,
      resolved_at = now()
  where id = p_dispute_id;

  update public.sessions
  set state = 'resolved',
      updated_at = now()
  where id = v_ses.id;

  v_learner_account := public.ensure_user_credit_account(v_ses.learner_id);
  v_instructor_account := public.ensure_user_credit_account(v_ses.instructor_id);

  if p_resolution = 'resolved_refund' then
    perform public.ledger_transfer(
      '00000000-0000-0000-0000-000000000001'::uuid,
      v_learner_account,
      v_ses.price_credit_amount,
      'refund',
      v_ses.id,
      'dispute_refund:' || v_disp.id::text,
      'Reintegro 100% por resolución de disputa: ' || trim(coalesce(p_resolution_note, '')),
      v_uid
    );
  elsif p_resolution = 'resolved_release' then
    perform public.ledger_transfer(
      '00000000-0000-0000-0000-000000000001'::uuid,
      v_instructor_account,
      v_ses.price_credit_amount,
      'release',
      v_ses.id,
      'dispute_release:' || v_disp.id::text,
      'Liberación al instructor tras revisión de disputa: ' || trim(coalesce(p_resolution_note, '')),
      v_uid
    );
  end if;

  return jsonb_build_object(
    'dispute_id', p_dispute_id,
    'session_id', v_ses.id,
    'status', p_resolution
  );
end;
$$;

create or replace function public.verify_ledger_invariants()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negative_users integer;
  v_total_credits bigint;
  v_escrow_balance integer;
  v_duplicate_incentives integer;
  v_invalid_tx_amounts integer;
  v_monetary_absent boolean;
begin
  select count(*) into v_negative_users
  from public.credit_accounts
  where kind = 'user' and balance < 0;

  select coalesce(sum(balance), 0) into v_total_credits
  from public.credit_accounts;

  select coalesce(balance, 0) into v_escrow_balance
  from public.credit_accounts
  where kind = 'escrow'
  limit 1;

  select count(*) into v_duplicate_incentives
  from (
    select to_account
    from public.credit_transactions
    where type = 'incentive'
    group by to_account
    having count(*) > 1
  ) dup;

  select count(*) into v_invalid_tx_amounts
  from public.credit_transactions
  where amount < 1;

  v_monetary_absent := to_regclass('public.monetary_payments') is null;

  return jsonb_build_object(
    'healthy', (
      v_negative_users = 0
      and v_total_credits = 1000000
      and v_escrow_balance >= 0
      and v_duplicate_incentives = 0
      and v_invalid_tx_amounts = 0
      and v_monetary_absent
    ),
    'checked_at', now(),
    'negative_user_accounts', v_negative_users,
    'total_system_credits', v_total_credits,
    'escrow_balance', v_escrow_balance,
    'duplicate_incentives', v_duplicate_incentives,
    'invalid_transaction_amounts', v_invalid_tx_amounts,
    'integer_only_non_cashable_credits', true,
    'monetary_table_absent', v_monetary_absent
  );
end;
$$;

commit;
