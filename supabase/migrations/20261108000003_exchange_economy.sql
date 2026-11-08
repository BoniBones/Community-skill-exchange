-- =============================================================================
-- Community Skill Exchange — Stage 4 Exchange Economy Migration
-- Separated monetary payments tracking (ARS), mixed-payment coordination,
-- 48-hour late-cancellation objection/force-majeure window (zero automatic
-- irreversible penalties), and double-entry credit ledger invariant auditing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend monetary_payments status & RLS policies
-- -----------------------------------------------------------------------------

alter table public.monetary_payments
  drop constraint if exists monetary_payments_status_check;

alter table public.monetary_payments
  add constraint monetary_payments_status_check
  check (status in ('pending', 'reported_by_payer', 'confirmed_by_payee', 'disputed', 'refunded'));

drop policy if exists "Participant read monetary payments" on public.monetary_payments;
create policy "Participant read monetary payments" on public.monetary_payments
  for select using (auth.uid() = payer_id or auth.uid() = payee_id);

-- -----------------------------------------------------------------------------
-- 2. Extend sessions with 48h late-cancellation review window & objection fields
-- -----------------------------------------------------------------------------

alter table public.sessions
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_timing text
    check (cancellation_timing in ('timely', 'late_review_window')),
  add column if not exists review_window_ends_at timestamptz,
  add column if not exists objection_reason text,
  add column if not exists objection_submitted_at timestamptz;

-- -----------------------------------------------------------------------------
-- 3. Monetary Payment Coordination RPCs (Separated from Credit Ledger)
-- -----------------------------------------------------------------------------

create or replace function public.report_monetary_payment(
  p_session_id uuid,
  p_method text default 'cash_or_transfer',
  p_external_ref text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mp record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_method not in ('cash_or_transfer', 'mercadopago') then
    raise exception 'Invalid payment method';
  end if;

  select * into v_mp
  from public.monetary_payments
  where session_id = p_session_id
  for update;

  if v_mp is null then
    raise exception 'Monetary payment record not found for this session';
  end if;

  if v_mp.payer_id <> v_uid then
    raise exception 'Only the learner (payer) can report a monetary payment';
  end if;

  if v_mp.status not in ('pending', 'reported_by_payer') then
    raise exception 'Monetary payment cannot be reported in its current state (%)', v_mp.status;
  end if;

  update public.monetary_payments
  set method = p_method,
      status = 'reported_by_payer',
      external_ref = nullif(trim(coalesce(p_external_ref, '')), ''),
      updated_at = now()
  where id = v_mp.id
  returning * into v_mp;

  return jsonb_build_object(
    'id', v_mp.id,
    'session_id', v_mp.session_id,
    'status', v_mp.status,
    'method', v_mp.method,
    'external_ref', v_mp.external_ref,
    'updated_at', v_mp.updated_at
  );
end;
$$;

create or replace function public.confirm_monetary_payment(
  p_session_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mp record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_mp
  from public.monetary_payments
  where session_id = p_session_id
  for update;

  if v_mp is null then
    raise exception 'Monetary payment record not found for this session';
  end if;

  if v_mp.payee_id <> v_uid then
    raise exception 'Only the instructor (payee) can confirm receipt of a monetary payment';
  end if;

  if v_mp.status not in ('pending', 'reported_by_payer') then
    raise exception 'Monetary payment cannot be confirmed in its current state (%)', v_mp.status;
  end if;

  update public.monetary_payments
  set status = 'confirmed_by_payee',
      updated_at = now()
  where id = v_mp.id
  returning * into v_mp;

  return jsonb_build_object(
    'id', v_mp.id,
    'session_id', v_mp.session_id,
    'status', v_mp.status,
    'updated_at', v_mp.updated_at
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Enhanced Cancel Session & 48-Hour Force-Majeure Objection RPC
-- -----------------------------------------------------------------------------

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
  v_hours_before numeric;
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

  -- Update separate monetary payment record if applicable
  update public.monetary_payments
  set status = case when v_is_timely then 'refunded' else 'disputed' end,
      updated_at = now()
  where session_id = p_session_id;

  -- Full credit refund if instructor cancelled OR learner cancelled >= 24h in advance.
  -- If < 24h, credits remain in escrow during the 48h review window (NO automatic penalty).
  if v_ses.price_mode in ('credits', 'mixed') and coalesce(v_ses.price_credit_amount, 0) > 0 then
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

create or replace function public.submit_cancellation_objection(
  p_session_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ses record;
  v_dispute_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) < 6 then
    raise exception 'Please provide a force-majeure or objection reason (at least 6 characters)';
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

  update public.sessions
  set state = 'disputed',
      cancellation_timing = 'late_review_window',
      objection_reason = trim(p_reason),
      objection_submitted_at = now(),
      updated_at = now()
  where id = p_session_id;

  insert into public.session_events (session_id, from_state, to_state, actor_id, reason)
  values (p_session_id, v_ses.state, 'disputed', v_uid, trim(p_reason));

  insert into public.disputes (session_id, opened_by, reason, status)
  values (p_session_id, v_uid, trim(p_reason), 'open')
  returning id into v_dispute_id;

  return jsonb_build_object(
    'session_id', p_session_id,
    'dispute_id', v_dispute_id,
    'state', 'disputed',
    'objection_submitted_at', now()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Auditable Double-Entry Ledger Invariant Verification RPC
-- -----------------------------------------------------------------------------

create or replace function public.verify_ledger_invariants()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negative_users integer;
  v_total_credits numeric;
  v_escrow_balance numeric;
  v_Duplicate_incentives integer;
begin
  -- 1. No user account can have a negative balance
  select count(*) into v_negative_users
  from public.credit_accounts
  where kind = 'user' and balance < 0;

  -- 2. Closed-loop conservation: sum of all credit_accounts must equal initial system pool (1,000,000)
  select coalesce(sum(balance), 0) into v_total_credits
  from public.credit_accounts;

  -- 3. Escrow balance must be non-negative
  select coalesce(balance, 0) into v_escrow_balance
  from public.credit_accounts
  where kind = 'escrow'
  limit 1;

  -- 4. Each user can receive at most one initial participation incentive
  select count(*) into v_duplicate_incentives
  from (
    select to_account
    from public.credit_transactions
    where type = 'incentive'
    group by to_account
    having count(*) > 1
  ) dup;

  return jsonb_build_object(
    'healthy', (v_negative_users = 0 and v_total_credits = 1000000 and v_escrow_balance >= 0 and v_duplicate_incentives = 0),
    'checked_at', now(),
    'negative_user_accounts', v_negative_users,
    'total_system_credits', v_total_credits,
    'escrow_balance', v_escrow_balance,
    'duplicate_incentives', v_duplicate_incentives
  );
end;
$$;
