/**
 * In-memory repository backed by src/mocks/data.ts. DEMO ONLY: it simulates
 * network latency and in-session mutations (onboarding, profile edits, activity
 * publishing with flexible payment arrangements, availability windows, booking
 * requests with credit escrow holds, session confirm/decline/cancel, and blocking
 * users), but nothing is persisted across app restarts.
 */
import { categoryOfSkill, skillName } from '../domain/catalog';
import type {
  Activity,
  ActivityRecommendation,
  AvailabilityWindow,
  CreditWallet,
  DayPeriod,
  ID,
  LedgerIntegrityReport,
  LedgerInvariantCheck,
  MatchKind,
  MonetaryPayment,
  PaymentArrangement,
  ProfileStatus,
  Session,
} from '../domain/types';
import * as db from '../mocks/data';
import type { Repository } from './repository';

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const MAX_BALANCE = 20;
const MIN_PILOT_AGE = 18;
const CANCELLATION_DEADLINE_HOURS = 24;
const OBJECTION_WINDOW_HOURS = 48;

const blockedByUser = new Map<ID, Set<ID>>();

function getBlockedSet(userId: ID): Set<ID> {
  let set = blockedByUser.get(userId);
  if (!set) {
    set = new Set<ID>();
    blockedByUser.set(userId, set);
  }
  return set;
}

function calculateAge(year: number, month: number, day: number): number {
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const m = now.getUTCMonth() + 1 - month;
  if (m < 0 || (m === 0 && now.getUTCDate() < day)) {
    age -= 1;
  }
  return age;
}

function validatePaymentArrangement(p: PaymentArrangement): PaymentArrangement {
  if (p.mode === 'credits') {
    if (!p.creditAmount || p.creditAmount <= 0) {
      throw new Error('En modalidad «Solo créditos» debés indicar una cantidad mayor a 0.');
    }
    return { mode: 'credits', creditAmount: p.creditAmount, currency: 'ARS' };
  }
  if (p.mode === 'money') {
    if (!p.moneyAmountCents || p.moneyAmountCents <= 0) {
      throw new Error('En modalidad «Solo dinero» debés indicar un monto en ARS mayor a 0.');
    }
    return { mode: 'money', moneyAmountCents: p.moneyAmountCents, currency: 'ARS' };
  }
  if (!p.creditAmount || p.creditAmount <= 0 || !p.moneyAmountCents || !p.moneyAmountCents || p.moneyAmountCents <= 0) {
    throw new Error('En modalidad «Pago mixto» debés indicar tanto créditos (> 0) como un monto en ARS (> 0).');
  }
  return {
    mode: 'mixed',
    creditAmount: p.creditAmount,
    moneyAmountCents: p.moneyAmountCents,
    currency: 'ARS',
  };
}

const WEEKDAY_NAMES = ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'];
const PERIOD_NAMES: Record<DayPeriod, string> = {
  morning: 'mañana (9–12 h)',
  afternoon: 'tarde (15–18 h)',
  evening: 'noche (18–21 h)',
};

export function summarizeAvailability(windows: AvailabilityWindow[], customNote?: string): string {
  if (windows.length === 0) {
    return customNote?.trim() || 'A coordinar';
  }
  const byDay = new Map<number, DayPeriod[]>();
  for (const w of windows) {
    const list = byDay.get(w.weekday) ?? [];
    if (!list.includes(w.period)) list.push(w.period);
    byDay.set(w.weekday, list);
  }
  const parts: string[] = [];
  for (const [day, periods] of Array.from(byDay.entries()).sort((a, b) => a[0] - b[0])) {
    parts.push(`${WEEKDAY_NAMES[day]} (${periods.map((p) => PERIOD_NAMES[p]).join(', ')})`);
  }
  const summary = parts.join(' · ');
  return customNote?.trim() ? `${summary} — ${customNote.trim()}` : summary;
}

function computeWallet(): CreditWallet {
  const entries = [...db.ledger].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const posted = entries.filter((e) => e.status === 'posted');
  const pending = entries.filter((e) => e.status === 'pending');
  const sum = (xs: typeof entries) => xs.reduce((acc, e) => acc + e.amount, 0);

  const pendingHolds = pending.filter((e) => e.type === 'hold');
  const heldInEscrow = -sum(pendingHolds);
  const available = sum(posted) - heldInEscrow;
  const incomingPending = sum(pending.filter((e) => e.amount > 0));
  const earnedTotal = sum(posted.filter((e) => e.type === 'release'));
  const spentTotal =
    -sum(posted.filter((e) => e.type === 'hold' || e.type === 'penalty')) -
    sum(posted.filter((e) => e.type === 'refund'));

  return { available, heldInEscrow, incomingPending, earnedTotal, spentTotal, maxBalance: MAX_BALANCE, entries };
}

export function verifyWalletInvariants(
  wallet: CreditWallet,
  sessions: Session[],
  monetaryPayments: MonetaryPayment[],
): LedgerIntegrityReport {
  const posted = wallet.entries.filter((e) => e.status === 'posted');
  const incentivesTotal = posted.filter((e) => e.type === 'incentive').reduce((acc, e) => acc + e.amount, 0);
  const adjustmentsTotal = posted.filter((e) => e.type === 'adjustment').reduce((acc, e) => acc + e.amount, 0);

  // Invariant 1: Non-negative user balance
  const nonNegative = wallet.available >= 0;

  // Invariant 2: Double-entry conservation equation
  // available + heldInEscrow === incentives + earnedTotal + adjustments - spentTotal
  const lhs = Math.round((wallet.available + wallet.heldInEscrow) * 100) / 100;
  const rhs =
    Math.round((incentivesTotal + wallet.earnedTotal + adjustmentsTotal - wallet.spentTotal) * 100) / 100;
  const conservation = lhs === rhs;

  // Invariant 3: Escrow parity with sessions
  const pendingHolds = wallet.entries.filter((e) => e.status === 'pending' && e.type === 'hold');
  const escrowMatchesSessions = pendingHolds.every((hold) => {
    const ses = sessions.find((s) => s.id === hold.sessionId);
    if (!ses) return false;
    return (
      ses.state === 'requested' ||
      ses.state === 'confirmed' ||
      ses.state === 'in_progress' ||
      ses.state === 'disputed' ||
      (ses.state === 'cancelled' && ses.cancellationTiming === 'late_review_window')
    );
  });

  // Invariant 4: Idempotency uniqueness & single initial incentive
  const keys = wallet.entries.map((e) => e.idempotencyKey).filter((k): k is string => Boolean(k));
  const uniqueKeys = new Set(keys);
  const incentiveCount = wallet.entries.filter((e) => e.type === 'incentive').length;
  const idempotent = keys.length === uniqueKeys.size && incentiveCount <= 1;

  // Invariant 5: Strictly separated monetary (ARS) circuit
  const validMonetary = monetaryPayments.every((mp) => {
    const ses = sessions.find((s) => s.id === mp.sessionId);
    return mp.currency === 'ARS' && mp.amountCents > 0 && (!ses || ses.price.mode === 'money' || ses.price.mode === 'mixed');
  });

  const invariants: LedgerInvariantCheck[] = [
    {
      id: 'non_negative_balance',
      name: 'Saldo de créditos no negativo',
      passed: nonNegative,
      detail: `Disponible: ${wallet.available} cr (≥ 0)`,
    },
    {
      id: 'double_entry_conservation',
      name: 'Conservación por partida doble',
      passed: conservation,
      detail: `Disponible (${wallet.available}) + Custodia (${wallet.heldInEscrow}) = Incentivos (${incentivesTotal}) + Ganados (${wallet.earnedTotal}) − Usados (${wallet.spentTotal})`,
    },
    {
      id: 'escrow_session_parity',
      name: 'Paridad entre custodia y sesiones activas/en revisión',
      passed: escrowMatchesSessions,
      detail: `${pendingHolds.length} retención(es) activa(s) vinculadas a sesiones vigentes o en ventana de 48 h`,
    },
    {
      id: 'idempotency_uniqueness',
      name: 'Idempotencia e incentivo inicial único',
      passed: idempotent,
      detail: `${uniqueKeys.size} claves únicas · ${incentiveCount} incentivo inicial otorgado`,
    },
    {
      id: 'separated_monetary_circuit',
      name: 'Separación contable entre créditos y ARS',
      passed: validMonetary,
      detail: `${monetaryPayments.length} registro(s) en ARS en tabla separada (sin tasa de cambio fija)`,
    },
  ];

  const maxBalance = wallet.maxBalance ?? MAX_BALANCE;
  const circulationRatio = Math.min(1, Math.max(0, wallet.available / maxBalance));
  const softCapReached = wallet.available + wallet.incomingPending >= maxBalance * 0.8;

  return {
    healthy: invariants.every((i) => i.passed),
    checkedAt: new Date().toISOString(),
    available: wallet.available,
    heldInEscrow: wallet.heldInEscrow,
    incomingPending: wallet.incomingPending,
    maxBalance,
    circulationRatio,
    softCapReached,
    invariants,
  };
}

export const mockRepository: Repository = {
  kind: 'mock',

  async getCurrentUserId() {
    return db.CURRENT_USER_ID;
  },

  async getProfile(id) {
    await delay();
    const p = db.profiles.find((x) => x.id === id);
    return p
      ? {
          ...p,
          skills: [...p.skills],
          availabilityWindows: p.availabilityWindows ? [...p.availabilityWindows] : undefined,
        }
      : null;
  },

  async updateProfile(userId, input) {
    await delay(200);
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx < 0) throw new Error('Perfil no encontrado');
    const updated = {
      ...db.profiles[idx]!,
      displayName: input.displayName.trim(),
      neighborhoodId: input.neighborhoodId,
      bio: input.bio.trim(),
      availabilitySummary: input.availabilitySummary.trim(),
      skills: [...input.skills],
      status: 'active' as ProfileStatus,
    };
    db.profiles[idx] = updated;
    return { ...updated, skills: [...updated.skills] };
  },

  async updateAvailability(userId, input) {
    await delay(200);
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx < 0) throw new Error('Perfil no encontrado');
    const summary = summarizeAvailability(input.windows, input.customNote);
    const updated = {
      ...db.profiles[idx]!,
      availabilityWindows: [...input.windows],
      availabilitySummary: summary,
    };
    db.profiles[idx] = updated;
    return { ...updated, skills: [...updated.skills], availabilityWindows: [...input.windows] };
  },

  async submitEligibility(userId, input) {
    await delay(200);
    const age = calculateAge(input.birthYear, input.birthMonth, input.birthDay);
    if (!input.acceptedSafetyRules) {
      return {
        status: 'pending_eligibility',
        age,
        eligible: false,
        message: 'Debés aceptar las normas de convivencia y seguridad de la comunidad.',
      };
    }
    if (age < 13) {
      return {
        status: 'restricted',
        age,
        eligible: false,
        message: 'Por razones legales y de seguridad, la plataforma no admite registros de menores de 13 años.',
      };
    }
    if (age < MIN_PILOT_AGE) {
      return {
        status: 'restricted',
        age,
        eligible: false,
        message:
          'Durante el piloto inicial en Santo Tomás, la participación está habilitada para mayores de 18 años. Tu solicitud con consentimiento parental queda registrada en estado restringido hasta su habilitación.',
      };
    }
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx >= 0) {
      db.profiles[idx] = { ...db.profiles[idx]!, status: 'active' };
    }
    return {
      status: 'active',
      age,
      eligible: true,
      message: 'Elegibilidad verificada (+18).',
    };
  },

  async listActivities(filters = {}) {
    await delay();
    const blocked = getBlockedSet(db.CURRENT_USER_ID);
    const me = db.profiles.find((p) => p.id === db.CURRENT_USER_ID);
    const myOffers = new Set((me?.skills ?? []).filter((s) => s.kind === 'offers').map((s) => s.skillId));
    const q = filters.query?.trim().toLowerCase();

    return db.activities.filter((a) => {
      if (a.status !== 'published') return false;
      if (blocked.has(a.instructorId)) return false;
      if (filters.categoryId && categoryOfSkill(a.skillId)?.id !== filters.categoryId) return false;
      if (filters.paymentMode && a.payment.mode !== filters.paymentMode) return false;
      if (filters.format && a.format !== 'either' && a.format !== filters.format) return false;

      const instructor = db.profiles.find((p) => p.id === a.instructorId);
      if (filters.neighborhoodId && instructor?.neighborhoodId !== filters.neighborhoodId) return false;

      if (filters.onlyReciprocal) {
        if (a.instructorId === db.CURRENT_USER_ID || !instructor) return false;
        const hasReciprocal = instructor.skills.some((s) => s.kind === 'wants' && myOffers.has(s.skillId));
        if (!hasReciprocal) return false;
      }

      if (q) {
        const haystack = `${a.title} ${a.description} ${skillName(a.skillId)} ${instructor?.displayName ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  },

  async listActivitiesByInstructor(instructorId) {
    await delay();
    return db.activities.filter((a) => a.instructorId === instructorId && a.status !== 'archived');
  },

  async getActivity(id) {
    await delay();
    return db.activities.find((a) => a.id === id) ?? null;
  },

  async upsertActivity(instructorId, input) {
    await delay(250);
    const title = input.title.trim();
    const description = input.description.trim();
    const meetingArea = input.meetingArea.trim();
    if (title.length < 4) throw new Error('El título debe tener al menos 4 caracteres.');
    if (description.length < 10) throw new Error('La descripción debe tener al menos 10 caracteres.');
    if (meetingArea.length < 3) throw new Error('Indicá un punto de encuentro público o modalidad.');
    if (/mi casa|domicilio particular|depto|departamento/i.test(meetingArea)) {
      throw new Error(
        'Por seguridad comunitaria, nunca publiques un domicilio particular. Elegí un espacio público (plaza, biblioteca, club, centro cultural) o modalidad online.',
      );
    }

    const payment = validatePaymentArrangement(input.payment);

    // Ensure the instructor profile lists this skill under 'offers'
    const profIdx = db.profiles.findIndex((p) => p.id === instructorId);
    if (profIdx >= 0) {
      const prof = db.profiles[profIdx]!;
      const alreadyOffers = prof.skills.some((s) => s.kind === 'offers' && s.skillId === input.skillId);
      if (!alreadyOffers) {
        prof.skills.push({ skillId: input.skillId, kind: 'offers', level: 'advanced' });
      }
    }

    if (input.id) {
      const idx = db.activities.findIndex((a) => a.id === input.id && a.instructorId === instructorId);
      if (idx < 0) throw new Error('Actividad no encontrada.');
      const updated: Activity = {
        ...db.activities[idx]!,
        skillId: input.skillId,
        title,
        description,
        durationMin: input.durationMin,
        format: input.format,
        meetingArea,
        requirements: input.requirements.trim() || 'Ninguno',
        availabilitySummary: input.availabilitySummary.trim() || 'A coordinar',
        payment,
        status: input.status,
      };
      db.activities[idx] = updated;
      return { activity: updated, grantedIncentive: false };
    }

    const created: Activity = {
      id: `a-${Date.now()}`,
      instructorId,
      skillId: input.skillId,
      title,
      description,
      durationMin: input.durationMin,
      format: input.format,
      meetingArea,
      requirements: input.requirements.trim() || 'Ninguno',
      availabilitySummary: input.availabilitySummary.trim() || 'A coordinar',
      payment,
      status: input.status,
    };
    db.activities.unshift(created);

    // Check if initial participation incentive was already granted
    const hasIncentive = db.ledger.some((e) => e.type === 'incentive');
    let grantedIncentive = false;
    if (!hasIncentive && input.status === 'published') {
      db.ledger.unshift({
        id: `tx-inc-${Date.now()}`,
        type: 'incentive',
        amount: 2,
        idempotencyKey: `incentive:${instructorId}`,
        memo: 'Incentivo de participación: publicaste tu primera actividad en la comunidad',
        createdAt: new Date().toISOString(),
        status: 'posted',
      });
      grantedIncentive = true;
    }

    return { activity: created, grantedIncentive };
  },

  async getRecommendations(userId) {
    await delay();
    const me = db.profiles.find((p) => p.id === userId);
    if (!me) return [];
    const blocked = getBlockedSet(userId);
    const myOffers = new Set(me.skills.filter((s) => s.kind === 'offers').map((s) => s.skillId));
    const myWants = new Set(me.skills.filter((s) => s.kind === 'wants').map((s) => s.skillId));

    const recs: ActivityRecommendation[] = [];
    for (const activity of db.activities) {
      if (activity.status !== 'published' || activity.instructorId === userId) continue;
      if (blocked.has(activity.instructorId)) continue;
      const instructor = db.profiles.find((p) => p.id === activity.instructorId);
      if (!instructor) continue;

      const reasons: MatchKind[] = [];
      let score = 0;
      const reciprocal = instructor.skills.find((s) => s.kind === 'wants' && myOffers.has(s.skillId));
      if (reciprocal) {
        score += 5;
        reasons.push('reciprocal');
      }
      if (myWants.has(activity.skillId)) {
        score += 3;
        reasons.push('wants_skill');
      }
      if (instructor.neighborhoodId === me.neighborhoodId) {
        score += 2;
        reasons.push('nearby');
      }
      if (instructor.ratingAvg !== null) score += Math.max(0, instructor.ratingAvg - 4);

      if (score > 0) {
        recs.push({ activity, instructor, score, reasons, reciprocalSkillId: reciprocal?.skillId });
      }
    }
    return recs.sort((a, b) => b.score - a.score);
  },

  async listSessions(userId) {
    await delay();
    return db.sessions
      .filter((s) => s.learnerId === userId || s.instructorId === userId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },

  async getSession(id) {
    await delay();
    return db.sessions.find((s) => s.id === id) ?? null;
  },

  async requestSession(userId, input) {
    await delay(250);
    const activity = db.activities.find((a) => a.id === input.activityId);
    if (!activity) throw new Error('Actividad no encontrada');
    if (activity.instructorId === userId) {
      throw new Error('No podés reservar tu propia actividad.');
    }

    const creditCost = activity.payment.mode !== 'money' ? (activity.payment.creditAmount ?? 0) : 0;
    if (creditCost > 0) {
      const wallet = computeWallet();
      if (wallet.available < creditCost) {
        throw new Error(
          `Saldo insuficiente: esta actividad requiere ${creditCost} crédito(s) y tenés ${wallet.available} disponible(s). ¡Enseñá una actividad para sumar créditos!`,
        );
      }
    }

    const nowIso = new Date().toISOString();
    const startsMs = new Date(input.startsAt).getTime();
    const endsAt = new Date(startsMs + activity.durationMin * 60_000).toISOString();
    const newSession: Session = {
      id: `ses-${Date.now()}`,
      activityId: activity.id,
      learnerId: userId,
      instructorId: activity.instructorId,
      startsAt: input.startsAt,
      endsAt,
      state: 'requested',
      price: { ...activity.payment },
      learnerNote: input.learnerNote?.trim() || undefined,
    };
    db.sessions.unshift(newSession);

    if (creditCost > 0) {
      db.ledger.unshift({
        id: `tx-${Date.now()}`,
        type: 'hold',
        amount: -creditCost,
        sessionId: newSession.id,
        idempotencyKey: `hold:${newSession.id}`,
        memo: `${activity.title}: retenido en custodia hasta completar la sesión`,
        createdAt: nowIso,
        status: 'pending',
      });
    }

    // Separate accounting record for 'money' and 'mixed' payment modes
    const moneyCents = activity.payment.mode !== 'credits' ? (activity.payment.moneyAmountCents ?? 0) : 0;
    if (moneyCents > 0) {
      db.monetaryPayments.unshift({
        id: `mp-${Date.now()}`,
        sessionId: newSession.id,
        activityTitle: activity.title,
        payerId: userId,
        payeeId: activity.instructorId,
        amountCents: moneyCents,
        currency: 'ARS',
        method: 'cash_or_transfer',
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    return newSession;
  },

  async respondToSession(userId, input) {
    await delay(200);
    const idx = db.sessions.findIndex((s) => s.id === input.sessionId);
    if (idx < 0) throw new Error('Sesión no encontrada.');
    const s = db.sessions[idx]!;
    if (s.instructorId !== userId) {
      throw new Error('Solo el instructor puede confirmar o rechazar una solicitud.');
    }
    if (s.state !== 'requested') {
      throw new Error('Esta sesión ya no está pendiente de confirmación.');
    }

    if (input.decision === 'confirm') {
      const updated: Session = { ...s, state: 'confirmed' };
      db.sessions[idx] = updated;
      return updated;
    }

    // Declined -> refund any held credits and void any pending monetary payment record
    const updated: Session = { ...s, state: 'declined' };
    db.sessions[idx] = updated;
    const holdIdx = db.ledger.findIndex((e) => e.sessionId === s.id && e.type === 'hold' && e.status === 'pending');
    if (holdIdx >= 0) {
      const hold = db.ledger[holdIdx]!;
      db.ledger[holdIdx] = { ...hold, status: 'posted' };
      db.ledger.unshift({
        id: `tx-ref-${Date.now()}`,
        type: 'refund',
        amount: Math.abs(hold.amount),
        sessionId: s.id,
        idempotencyKey: `refund:${s.id}`,
        memo: 'Reintegro: el instructor no pudo tomar la solicitud',
        createdAt: new Date().toISOString(),
        status: 'posted',
      });
    }
    const mpIdx = db.monetaryPayments.findIndex((mp) => mp.sessionId === s.id);
    if (mpIdx >= 0) {
      db.monetaryPayments[mpIdx] = {
        ...db.monetaryPayments[mpIdx]!,
        status: 'refunded',
        updatedAt: new Date().toISOString(),
      };
    }
    return updated;
  },

  async cancelSession(userId, input) {
    await delay(200);
    const idx = db.sessions.findIndex((s) => s.id === input.sessionId);
    if (idx < 0) throw new Error('Sesión no encontrada.');
    const s = db.sessions[idx]!;
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error('No sos participante de esta sesión.');
    }
    if (s.state !== 'requested' && s.state !== 'confirmed') {
      throw new Error('Solo se pueden cancelar sesiones solicitadas o confirmadas.');
    }

    const hoursUntilStart = (new Date(s.startsAt).getTime() - Date.now()) / 3_600_000;
    const cancelledByInstructor = s.instructorId === userId;
    const isTimely =
      !input.simulateLateWindow && (cancelledByInstructor || hoursUntilStart >= CANCELLATION_DEADLINE_HOURS);

    const reviewWindowEndsAt = !isTimely
      ? new Date(Date.now() + OBJECTION_WINDOW_HOURS * 3_600_000).toISOString()
      : undefined;

    const updated: Session = {
      ...s,
      state: 'cancelled',
      cancellationReason: input.reason.trim() || 'Cancelada por participante',
      cancellationTiming: isTimely ? 'timely' : 'late_review_window',
      reviewWindowEndsAt,
    };
    db.sessions[idx] = updated;

    // Update monetary payment record if present
    const mpIdx = db.monetaryPayments.findIndex((mp) => mp.sessionId === s.id);
    if (mpIdx >= 0) {
      db.monetaryPayments[mpIdx] = {
        ...db.monetaryPayments[mpIdx]!,
        status: isTimely ? 'refunded' : 'disputed',
        updatedAt: new Date().toISOString(),
      };
    }

    const holdIdx = db.ledger.findIndex((e) => e.sessionId === s.id && e.type === 'hold' && e.status === 'pending');
    if (holdIdx >= 0) {
      const hold = db.ledger[holdIdx]!;
      if (isTimely) {
        db.ledger[holdIdx] = { ...hold, status: 'posted' };
        db.ledger.unshift({
          id: `tx-ref-${Date.now()}`,
          type: 'refund',
          amount: Math.abs(hold.amount),
          sessionId: s.id,
          idempotencyKey: `refund:${s.id}`,
          memo: cancelledByInstructor
            ? 'Reintegro total: el instructor canceló la sesión'
            : 'Reintegro total: cancelaste con más de 24 h de anticipación',
          createdAt: new Date().toISOString(),
          status: 'posted',
        });
        return {
          session: updated,
          refundMessage: `Se reintegraron ${Math.abs(hold.amount)} crédito(s) a tu saldo disponible.`,
        };
      } else {
        // Late cancellation: keep in pending state for the 48h objection / administrative review window
        db.ledger[holdIdx] = {
          ...hold,
          memo: `${hold.memo} (cancelación con <24 h: en ventana de revisión de 48 h)`,
        };
        return {
          session: updated,
          refundMessage:
            'Cancelación con menos de 24 h: los créditos permanecen en custodia durante la ventana de revisión de 48 h (sin penalidad automática irreversible). Podés presentar un descargo por fuerza mayor.',
        };
      }
    }

    return {
      session: updated,
      refundMessage: isTimely
        ? 'La sesión fue cancelada a término sin cargos.'
        : 'Cancelación registrada dentro de las 24 h previas: se abrió la ventana de revisión de 48 h.',
    };
  },

  async submitCancellationObjection(userId, input) {
    await delay(200);
    const reason = input.reason.trim();
    if (reason.length < 6) {
      throw new Error('Describí brevemente el motivo de fuerza mayor o imprevisto (al menos 6 caracteres).');
    }
    const idx = db.sessions.findIndex((s) => s.id === input.sessionId);
    if (idx < 0) throw new Error('Sesión no encontrada.');
    const s = db.sessions[idx]!;
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error('No sos participante de esta sesión.');
    }

    const nowIso = new Date().toISOString();
    const updated: Session = {
      ...s,
      state: 'disputed',
      cancellationTiming: 'late_review_window',
      objectionReason: reason,
      objectionSubmittedAt: nowIso,
    };
    db.sessions[idx] = updated;

    const holdIdx = db.ledger.findIndex((e) => e.sessionId === s.id && e.type === 'hold' && e.status === 'pending');
    if (holdIdx >= 0) {
      const hold = db.ledger[holdIdx]!;
      db.ledger[holdIdx] = {
        ...hold,
        memo: `${hold.memo.split(' (')[0]} (descargo presentado · en revisión administrativa sin penalidad automática)`,
      };
    }

    return updated;
  },

  async getWallet(): Promise<CreditWallet> {
    await delay();
    return computeWallet();
  },

  async getLedgerIntegrity(): Promise<LedgerIntegrityReport> {
    await delay(100);
    const wallet = computeWallet();
    return verifyWalletInvariants(wallet, db.sessions, db.monetaryPayments);
  },

  async listMonetaryPayments(userId) {
    await delay(120);
    return db.monetaryPayments
      .filter((mp) => mp.payerId === userId || mp.payeeId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getMonetaryPaymentBySession(sessionId) {
    await delay(100);
    return db.monetaryPayments.find((mp) => mp.sessionId === sessionId) ?? null;
  },

  async reportMonetaryPayment(userId, input) {
    await delay(200);
    const idx = db.monetaryPayments.findIndex((mp) => mp.sessionId === input.sessionId);
    if (idx < 0) throw new Error('No se encontró un registro de pago en ARS para esta sesión.');
    const mp = db.monetaryPayments[idx]!;
    if (mp.payerId !== userId) {
      throw new Error('Solo quien toma la actividad puede informar el envío del pago en ARS.');
    }
    const updated: MonetaryPayment = {
      ...mp,
      method: input.method,
      status: 'reported_by_payer',
      externalRef: input.externalRef?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    db.monetaryPayments[idx] = updated;
    return updated;
  },

  async confirmMonetaryPayment(userId, input) {
    await delay(200);
    const idx = db.monetaryPayments.findIndex((mp) => mp.sessionId === input.sessionId);
    if (idx < 0) throw new Error('No se encontró un registro de pago en ARS para esta sesión.');
    const mp = db.monetaryPayments[idx]!;
    if (mp.payeeId !== userId) {
      throw new Error('Solo el instructor puede confirmar la recepción del pago en ARS.');
    }
    const updated: MonetaryPayment = {
      ...mp,
      status: 'confirmed_by_payee',
      updatedAt: new Date().toISOString(),
    };
    db.monetaryPayments[idx] = updated;
    return updated;
  },

  async listReviewsAbout(userId) {
    await delay();
    return db.reviews.filter((r) => r.subjectId === userId);
  },

  async reportOrBlockUser(userId, input) {
    await delay(200);
    if (input.blockUser) {
      getBlockedSet(userId).add(input.targetUserId);
    }
  },

  async listBlockedUserIds(userId) {
    await delay(100);
    return Array.from(getBlockedSet(userId));
  },
};
