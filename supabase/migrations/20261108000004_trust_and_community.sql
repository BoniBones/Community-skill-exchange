-- =============================================================================
-- Community Skill Exchange — Stage 5 Trust & Community Migration
-- Two-stage 90-second dynamic QR verification (SHA-256 single-use tokens),
-- atomic credit escrow release on check-out, verified post-session reviews
-- with automatic rating aggregation, in-app notifications, and role-gated
-- dispute resolution.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Issue 90-Second Single-Use Session Verification Token (SHA-256)
-- -----------------------------------------------------------------------------

create or replace function public.issue_session_token(
  p_session_id uuid,
  p_phase text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ses record;
  v_code text;
  v_hash text;
  v_expires timestamptz := now() + interval '90 seconds';
  v_tok_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_phase not in ('check_in', 'check_out') then
    raise exception 'Invalid verification phase (%)', p_phase;
  end if;

  select * into v_ses
  from public.sessions
  where id = p_session_id;

  if v_ses is null then
    raise exception 'Session not found';
  end if;

  if v_ses.learner_id <> v_uid and v_ses.instructor_id <> v_uid then
    raise exception 'Not a participant of this session';
  end if;

  if p_phase = 'check_in' and v_ses.state <> 'confirmed' then
    raise exception 'Check-in requires session to be in confirmed state';
  end if;

  if p_phase = 'check_out' and v_ses.state <> 'in_progress' then
    raise exception 'Check-out requires session to be in in_progress state';
  end if;

  -- Generate 6-char uppercase alphanumeric code
  v_code := upper(substr(replace(encode(gen_random_bytes(6), 'base64'), '/', 'X'), 1, 6));
  v_hash := encode(digest(p_session_id::text || ':' || p_phase || ':' || v_code, 'sha256'), 'hex');

  insert into public.session_verification_tokens (
    session_id, phase, issuer_id, token_hash, expires_at
  ) values (
    p_session_id, p_phase, v_uid, v_hash, v_expires
  ) returning id into v_tok_id;

  return jsonb_build_object(
    'id', v_tok_id,
    'session_id', p_session_id,
    'phase', p_phase,
    'code', v_code,
    'token_hash', v_hash,
    'qr_payload', 'cse://verify?session=' || p_session_id::text || '&phase=' || p_phase || '&code=' || v_code,
    'expires_at', v_expires
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Redeem Session Verification Token + Atomic Escrow Release on Check-Out
-- -----------------------------------------------------------------------------

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
  v_released numeric := 0;
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

  -- Stage 2: check_out -> complete session & atomically release escrow to instructor
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

  if v_ses.price_mode in ('credits', 'mixed') and coalesce(v_ses.price_credit_amount, 0) > 0 then
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
  end if;

  -- Increment community participation counters for both learner and instructor
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

-- -----------------------------------------------------------------------------
-- 3. Submit Verified Post-Session Review + Rating Aggregation
-- -----------------------------------------------------------------------------

create or replace function public.submit_verified_review(
  p_session_id uuid,
  p_rating smallint,
  p_comment text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ses record;
  v_subject_id uuid;
  v_review_id uuid;
  v_avg numeric(3,2);
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select * into v_ses
  from public.sessions
  where id = p_session_id;

  if v_ses is null then
    raise exception 'Session not found';
  end if;

  if v_ses.state <> 'completed' then
    raise exception 'Reviews can only be submitted for completed sessions';
  end if;

  if v_ses.learner_id = v_uid then
    v_subject_id := v_ses.instructor_id;
  elsif v_ses.instructor_id = v_uid then
    v_subject_id := v_ses.learner_id;
  else
    raise exception 'Only session participants can submit a review';
  end if;

  insert into public.reviews (session_id, author_id, subject_id, rating, comment)
  values (p_session_id, v_uid, v_subject_id, p_rating, trim(coalesce(p_comment, '')))
  returning id into v_review_id;

  select round(avg(rating)::numeric, 2), count(*)
  into v_avg, v_count
  from public.reviews
  where subject_id = v_subject_id;

  update public.profiles
  set rating_avg = v_avg,
      rating_count = v_count,
      updated_at = now()
  where id = v_subject_id;

  insert into public.notifications (user_id, type, title, body, payload)
  values (
    v_subject_id,
    'review_received',
    'Recibiste una nueva reseña verificada (' || p_rating::text || ' ★)',
    trim(coalesce(p_comment, '')),
    jsonb_build_object('session_id', p_session_id, 'review_id', v_review_id)
  );

  return jsonb_build_object(
    'review_id', v_review_id,
    'subject_id', v_subject_id,
    'rating_avg', v_avg,
    'rating_count', v_count
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Role-Gated Dispute Resolution RPC (Moderator / Admin)
-- -----------------------------------------------------------------------------

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
  v_half numeric;
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

  if p_resolution not in ('resolved_refund', 'resolved_release', 'resolved_split') then
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

  if v_ses.price_mode in ('credits', 'mixed') and coalesce(v_ses.price_credit_amount, 0) > 0 then
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
    elsif p_resolution = 'resolved_split' then
      v_half := round(v_ses.price_credit_amount / 2.0, 2);
      perform public.ledger_transfer(
        '00000000-0000-0000-0000-000000000001'::uuid,
        v_learner_account,
        v_half,
        'refund',
        v_ses.id,
        'dispute_split_learner:' || v_disp.id::text,
        'Reintegro 50% por resolución compartida',
        v_uid
      );
      perform public.ledger_transfer(
        '00000000-0000-0000-0000-000000000001'::uuid,
        v_instructor_account,
        v_ses.price_credit_amount - v_half,
        'release',
        v_ses.id,
        'dispute_split_instructor:' || v_disp.id::text,
        'Liberación 50% por resolución compartida',
        v_uid
      );
    end if;
  end if;

  return jsonb_build_object(
    'dispute_id', p_dispute_id,
    'session_id', v_ses.id,
    'status', p_resolution
  );
end;
$$;
