-- =============================================================================
-- Community Skill Exchange — Safety Invariants Hardening Migration (CSE-M4)
-- Adds:
--   1. Server-side submit_eligibility RPC (+18 pilot gate & private_profiles)
--   2. Trigger guard protecting profiles.neighborhood_verified_at & neighborhood_id
--      from direct client tampering + missing-profile check in verify_neighborhood_access
--   3. Public meeting point constraint on activities + publish_activity_with_arrangement
--   4. Session-state, 48h window, and open-dispute uniqueness guards on
--      submit_cancellation_objection, disputes, and resolve_dispute
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Server-Side 18+ Eligibility RPC (mirrors mockRepository.submitEligibility)
-- -----------------------------------------------------------------------------

create or replace function public.submit_eligibility(
  p_birth_year integer,
  p_birth_month integer,
  p_birth_day integer,
  p_accepted_safety_rules boolean,
  p_guardian_email text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_birth_date date;
  v_age integer;
  v_clean_guardian_email text := nullif(trim(coalesce(p_guardian_email, '')), '');
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Profile not found';
  end if;

  if p_birth_year is null or p_birth_month is null or p_birth_day is null
     or p_birth_year < 1900 then
    raise exception 'Invalid birth date';
  end if;

  v_birth_date := make_date(p_birth_year, p_birth_month, p_birth_day);
  if v_birth_date > current_date then
    raise exception 'Birth date cannot be in the future';
  end if;

  v_age := extract(year from age(current_date, v_birth_date))::integer;

  if not coalesce(p_accepted_safety_rules, false) then
    return jsonb_build_object(
      'status', 'pending_eligibility',
      'age', v_age,
      'eligible', false
    );
  end if;

  if v_age < 13 then
    update public.profiles
    set status = 'restricted',
        updated_at = now()
    where id = v_uid;

    return jsonb_build_object(
      'status', 'restricted',
      'age', v_age,
      'eligible', false
    );
  end if;

  if v_age < 18 then
    insert into public.private_profiles (
      user_id, birth_date, accepted_safety_rules, guardian_email, updated_at
    ) values (
      v_uid, v_birth_date, true, v_clean_guardian_email, now()
    )
    on conflict (user_id) do update set
      birth_date = excluded.birth_date,
      accepted_safety_rules = true,
      guardian_email = coalesce(excluded.guardian_email, private_profiles.guardian_email),
      updated_at = now();

    update public.profiles
    set status = 'restricted',
        updated_at = now()
    where id = v_uid;

    return jsonb_build_object(
      'status', 'restricted',
      'age', v_age,
      'eligible', false
    );
  end if;

  insert into public.private_profiles (
    user_id, birth_date, accepted_safety_rules, updated_at
  ) values (
    v_uid, v_birth_date, true, now()
  )
  on conflict (user_id) do update set
    birth_date = excluded.birth_date,
    accepted_safety_rules = true,
    updated_at = now();

  update public.profiles
  set status = 'active',
      updated_at = now()
  where id = v_uid;

  return jsonb_build_object(
    'status', 'active',
    'age', v_age,
    'eligible', true
  );
end;
$$;

revoke all on function public.submit_eligibility(integer, integer, integer, boolean, text) from public, anon;
grant execute on function public.submit_eligibility(integer, integer, integer, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Guard profiles.neighborhood_verified_at & neighborhood_id + Hardened RPC
-- -----------------------------------------------------------------------------

create or replace function public.guard_profiles_neighborhood_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_bypass text := current_setting('app.bypass_neighborhood_verify_guard', true);
  v_is_client boolean := (
    current_user in ('anon', 'authenticated')
    or coalesce(auth.role(), '') in ('anon', 'authenticated')
  );
begin
  if v_is_client and v_bypass is distinct from 'on' then
    if tg_op = 'INSERT' and new.neighborhood_verified_at is not null then
      raise exception 'Direct modification of neighborhood verification timestamp is not permitted';
    end if;

    if tg_op = 'UPDATE' then
      if new.neighborhood_verified_at is distinct from old.neighborhood_verified_at then
        raise exception 'Direct modification of neighborhood verification timestamp is not permitted';
      end if;
      if new.neighborhood_id is distinct from old.neighborhood_id then
        raise exception 'Neighborhood changes must go through verify_neighborhood_access';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_neighborhood_fields on public.profiles;
create trigger trg_guard_profiles_neighborhood_fields
  before insert or update on public.profiles
  for each row
  execute function public.guard_profiles_neighborhood_fields();

create or replace function public.verify_neighborhood_access(
  p_neighborhood_id text,
  p_access_code text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_nb record;
  v_code_row record;
  v_trimmed_code text := trim(coalesce(p_access_code, ''));
  v_computed_hash text;
  v_verified_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select id, name, is_active
  into v_nb
  from public.neighborhoods
  where id = p_neighborhood_id;

  if v_nb is null then
    raise exception 'Neighborhood not found';
  end if;

  if not v_nb.is_active then
    raise exception 'Neighborhood is not active yet';
  end if;

  if v_trimmed_code = '' then
    raise exception 'Access code is required';
  end if;

  select neighborhood_id, code_salt, code_hash
  into v_code_row
  from public.private_neighborhood_codes
  where neighborhood_id = p_neighborhood_id;

  if v_code_row is null then
    raise exception 'Neighborhood access configuration missing';
  end if;

  v_computed_hash := encode(
    digest(v_code_row.code_salt || ':' || p_neighborhood_id || ':' || v_trimmed_code, 'sha256'),
    'hex'
  );

  if lower(v_computed_hash) <> lower(v_code_row.code_hash) then
    raise exception 'Invalid neighborhood access code';
  end if;

  perform set_config('app.bypass_neighborhood_verify_guard', 'on', true);

  update public.profiles
  set neighborhood_id = p_neighborhood_id,
      neighborhood_verified_at = v_verified_at,
      updated_at = now()
  where id = v_uid;

  if not found then
    perform set_config('app.bypass_neighborhood_verify_guard', '', true);
    raise exception 'Profile not found';
  end if;

  perform set_config('app.bypass_neighborhood_verify_guard', '', true);

  return jsonb_build_object(
    'neighborhood_id', p_neighborhood_id,
    'verified_at', v_verified_at
  );
end;
$$;

revoke all on function public.verify_neighborhood_access(text, text) from public, anon;
grant execute on function public.verify_neighborhood_access(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Public Meeting Area Guard on activities & publish_activity_with_arrangement
-- -----------------------------------------------------------------------------

alter table public.activities
  drop constraint if exists activities_public_meeting_area_check,
  add constraint activities_public_meeting_area_check
    check (meeting_area !~* '(mi casa|domicilio particular|depto|departamento)');

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

  if char_length(trim(coalesce(p_meeting_area, ''))) < 3 then
    raise exception 'Public meeting area must be at least 3 characters';
  end if;

  if trim(p_meeting_area) ~* '(mi casa|domicilio particular|depto|departamento)' then
    raise exception 'Private home addresses are not allowed; choose a public meeting point or online format';
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

-- -----------------------------------------------------------------------------
-- 4. Dispute & Objection Session-State Hardening
-- -----------------------------------------------------------------------------

create unique index if not exists disputes_one_open_per_session_uidx
  on public.disputes (session_id)
  where status = 'open';

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

  if exists (
    select 1 from public.disputes
    where session_id = p_session_id and status = 'open'
  ) then
    raise exception 'An open dispute already exists for this session';
  end if;

  if v_ses.state <> 'cancelled' or v_ses.cancellation_timing is distinct from 'late_review_window' then
    raise exception 'Objections are only allowed for late-cancelled sessions in the 48h review window';
  end if;

  if v_ses.review_window_ends_at is not null and v_ses.review_window_ends_at < now() then
    raise exception 'The 48h review window for this cancellation has expired';
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

  if v_ses is null or v_ses.state in ('completed', 'resolved', 'declined', 'expired') then
    raise exception 'Session is already finalized and cannot be resolved via dispute';
  end if;

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

commit;
