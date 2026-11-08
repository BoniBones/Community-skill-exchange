-- =============================================================================
-- Community Skill Exchange — Stage 3 Core Transactional RPCs
-- Atomic PostgreSQL functions for activity publishing (with one-time incentive),
-- booking with price snapshot & escrow hold, instructor confirmation/decline,
-- cancellation policy, and reciprocal matching.
-- =============================================================================

-- Ensure system credit accounts exist ('escrow' and 'incentive_pool')
insert into public.credit_accounts (id, owner_id, kind, balance) values
  ('00000000-0000-0000-0000-000000000001', null, 'escrow', 0),
  ('00000000-0000-0000-0000-000000000002', null, 'incentive_pool', 1000000),
  ('00000000-0000-0000-0000-000000000003', null, 'adjustments', 0)
on conflict (id) do nothing;

-- Helper: get or create a user's credit account (starts at 0)
create or replace function public.ensure_user_credit_account(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  select id into v_account_id
  from public.credit_accounts
  where owner_id = p_user_id and kind = 'user';

  if v_account_id is null then
    insert into public.credit_accounts (owner_id, kind, balance)
    values (p_user_id, 'user', 0)
    on conflict (owner_id) do update set updated_at = now()
    returning id into v_account_id;
  end if;

  return v_account_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Publish or Update Activity + Payment Arrangement + Initial Incentive
-- -----------------------------------------------------------------------------

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
  p_payment_mode text,
  p_credit_amount numeric,
  p_money_amount_cents bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_user_account uuid;
  v_incentive_amount numeric := 2;
  v_already_incentivized boolean;
  v_granted_incentive boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
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
    activity_id, mode, credit_amount, money_amount_cents, currency
  ) values (
    v_id,
    p_payment_mode,
    case when p_payment_mode in ('credits', 'mixed') then p_credit_amount else null end,
    case when p_payment_mode in ('money', 'mixed') then p_money_amount_cents else null end,
    'ARS'
  )
  on conflict (activity_id) do update set
    mode = excluded.mode,
    credit_amount = excluded.credit_amount,
    money_amount_cents = excluded.money_amount_cents;

  -- Ensure skill is listed in user_skills ('offers')
  insert into public.user_skills (user_id, skill_id, kind, level)
  values (v_uid, p_skill_id, 'offers', 'advanced')
  on conflict (user_id, skill_id, kind) do nothing;

  -- One-time initial participation incentive when publishing first activity
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

-- -----------------------------------------------------------------------------
-- 2. Book Session (Atomic Price Snapshot + Escrow Credit Hold)
-- -----------------------------------------------------------------------------

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
  v_pay record;
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

  select * into v_pay
  from public.payment_arrangements
  where activity_id = p_activity_id;

  insert into public.sessions (
    activity_id, learner_id, instructor_id, starts_at, ends_at, state,
    price_mode, price_credit_amount, price_money_cents, price_currency, learner_note
  ) values (
    p_activity_id,
    v_uid,
    v_act.instructor_id,
    p_starts_at,
    p_starts_at + make_interval(mins => v_act.duration_min),
    'requested',
    v_pay.mode,
    v_pay.credit_amount,
    v_pay.money_amount_cents,
    v_pay.currency,
    nullif(trim(coalesce(p_learner_note, '')), '')
  ) returning id into v_session_id;

  insert into public.session_events (session_id, from_state, to_state, actor_id, reason)
  values (v_session_id, null, 'requested', v_uid, 'Booking requested by learner');

  -- Hold credits in escrow if payment mode is 'credits' or 'mixed'
  if v_pay.mode in ('credits', 'mixed') and coalesce(v_pay.credit_amount, 0) > 0 then
    v_learner_account := public.ensure_user_credit_account(v_uid);
    perform public.ledger_transfer(
      v_learner_account,
      '00000000-0000-0000-0000-000000000001'::uuid,
      v_pay.credit_amount,
      'hold',
      v_session_id,
      'hold:' || v_session_id::text,
      v_act.title || ': retenido en custodia hasta completar la sesión',
      v_uid
    );
  end if;

  -- Create separate monetary payment record if payment mode is 'money' or 'mixed'
  if v_pay.mode in ('money', 'mixed') and coalesce(v_pay.money_amount_cents, 0) > 0 then
    insert into public.monetary_payments (
      session_id, payer_id, payee_id, amount_cents, currency, status
    ) values (
      v_session_id, v_uid, v_act.instructor_id, v_pay.money_amount_cents, 'ARS', 'pending'
    );
  end if;

  return v_session_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Instructor Respond to Session (Confirm or Decline with Escrow Refund)
-- -----------------------------------------------------------------------------

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
    if v_ses.price_mode in ('credits', 'mixed') and coalesce(v_ses.price_credit_amount, 0) > 0 then
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
    end if;
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

-- -----------------------------------------------------------------------------
-- 4. Cancel Session (24h Policy + Escrow Protection)
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
  v_refunded boolean := false;
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

  update public.sessions
  set state = 'cancelled', updated_at = now()
  where id = p_session_id;

  insert into public.session_events (session_id, from_state, to_state, actor_id, reason)
  values (p_session_id, v_ses.state, 'cancelled', v_uid, p_reason);

  -- Full refund if instructor cancelled OR learner cancelled >= 24h in advance
  if v_ses.price_mode in ('credits', 'mixed') and coalesce(v_ses.price_credit_amount, 0) > 0 then
    if v_uid = v_ses.instructor_id or v_hours_before >= 24 then
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
    'refunded', v_refunded
  );
end;
$$;
