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
  DisputeRecord,
  ID,
  LedgerIntegrityReport,
  LedgerInvariantCheck,
  MatchKind,
  MonetaryPayment,
  PaymentArrangement,
  ProfileStatus,
  Review,
  SafetyReportRecord,
  Session,
  SessionVerificationToken,
} from '../domain/types';
import * as db from '../mocks/data';
import type { Repository } from './repository';

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const MAX_BALANCE = 20;
const MIN_PILOT_AGE = 18;
const CANCELLATION_DEADLINE_HOURS = 24;
const OBJECTION_WINDOW_HOURS = 48;
const QR_TOKEN_TTL_SECONDS = 90;

const blockedByUser = new Map<ID, Set<ID>>();

function pseudoSha256Hex(raw: string): string {
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const part = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${part(h1)}${part(h2)}${part(h1 ^ h2)}${part(~h1)}${part(~h2)}${part(h1 + h2)}${part(h1 * 3)}${part(h2 * 7)}`;
}

function generateVerificationCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}

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

    const activity = db.activities.find((a) => a.id === s.activityId);
    const existingDispute = db.disputes.find((d) => d.sessionId === s.id && d.status === 'open');
    if (!existingDispute) {
      db.disputes.unshift({
        id: `disp-${Date.now()}`,
        sessionId: s.id,
        activityTitle: activity?.title ?? 'Sesión comunitaria',
        openedBy: userId,
        learnerId: s.learnerId,
        instructorId: s.instructorId,
        creditAmount: s.price.creditAmount ?? 0,
        reason,
        status: 'open',
        createdAt: nowIso,
      });
    }

    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: db.CURRENT_USER_ID,
      type: 'dispute_opened',
      title: 'Descargo por fuerza mayor en revisión',
      body: `Tu descargo para «${activity?.title ?? 'Sesión'}» quedó registrado sin penalidad automática.`,
      sessionId: s.id,
      actorId: userId,
      createdAt: nowIso,
    });

    return updated;
  },

  async issueSessionToken(userId, input) {
    await delay(150);
    const s = db.sessions.find((x) => x.id === input.sessionId);
    if (!s) throw new Error('Sesión no encontrada.');
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error('Solo los participantes de la sesión pueden emitir un código QR de asistencia.');
    }
    if (input.phase === 'check_in' && s.state !== 'confirmed') {
      throw new Error('El check-in de inicio requiere que la sesión esté en estado «Confirmada».');
    }
    if (input.phase === 'check_out' && s.state !== 'in_progress') {
      throw new Error('El check-out de cierre requiere haber completado primero el check-in («En curso»).');
    }

    const code = generateVerificationCode();
    const qrPayload = `cse://verify?session=${s.id}&phase=${input.phase}&code=${code}`;
    const tokenHash = pseudoSha256Hex(`${s.id}:${input.phase}:${code}`);
    const expiresAt = new Date(Date.now() + QR_TOKEN_TTL_SECONDS * 1000).toISOString();

    const token: SessionVerificationToken = {
      id: `tok-${Date.now()}`,
      sessionId: s.id,
      phase: input.phase,
      issuerId: userId,
      code,
      tokenHash,
      qrPayload,
      expiresAt,
    };
    db.verificationTokens.unshift(token);
    return token;
  },

  async redeemSessionToken(userId, input) {
    await delay(200);
    const idx = db.sessions.findIndex((x) => x.id === input.sessionId);
    if (idx < 0) throw new Error('Sesión no encontrada.');
    const s = db.sessions[idx]!;
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error('No sos participante de esta sesión.');
    }

    const normalizedCode = input.code.trim().toUpperCase();
    if (normalizedCode.length < 4) {
      throw new Error('Ingresá el código de 6 caracteres o escaneá el QR de la contraparte.');
    }

    const tokIdx = db.verificationTokens.findIndex(
      (t) => t.sessionId === s.id && t.phase === input.phase && t.code === normalizedCode && !t.usedAt,
    );
    if (tokIdx >= 0) {
      const tok = db.verificationTokens[tokIdx]!;
      if (new Date(tok.expiresAt).getTime() < Date.now()) {
        throw new Error('El código QR expiró (vigencia máxima: 90 segundos). Emití uno nuevo.');
      }
      db.verificationTokens[tokIdx] = {
        ...tok,
        usedAt: new Date().toISOString(),
        usedBy: userId,
      };
    }

    const nowIso = new Date().toISOString();
    const activity = db.activities.find((a) => a.id === s.activityId);

    if (input.phase === 'check_in') {
      if (s.state !== 'confirmed') {
        throw new Error('La sesión debe estar «Confirmada» para realizar el check-in.');
      }
      const updated: Session = {
        ...s,
        state: 'in_progress',
        checkedInAt: nowIso,
      };
      db.sessions[idx] = updated;
      return {
        session: updated,
        releasedCredits: 0,
        message: 'Check-in de inicio verificado (Etapa 1/2). La sesión ahora está «En curso».',
      };
    }

    // Phase 2: check_out -> complete session and atomically release credit escrow
    if (s.state !== 'in_progress') {
      throw new Error('Primero deben verificar el check-in de inicio antes del cierre.');
    }

    const updated: Session = {
      ...s,
      state: 'completed',
      checkedOutAt: nowIso,
    };
    db.sessions[idx] = updated;

    const creditAmount = s.price.mode !== 'money' ? (s.price.creditAmount ?? 0) : 0;

    // 1. If viewer is learner, settle their pending 'hold' -> 'posted'
    const holdIdx = db.ledger.findIndex((e) => e.sessionId === s.id && e.type === 'hold' && e.status === 'pending');
    if (holdIdx >= 0) {
      const hold = db.ledger[holdIdx]!;
      db.ledger[holdIdx] = {
        ...hold,
        status: 'posted',
        memo: `${activity?.title ?? 'Sesión'}: asistencia verificada en 2 etapas (transferido al instructor)`,
      };
    }

    // 2. If viewer is instructor, settle or create their 'release' -> 'posted'
    const relIdx = db.ledger.findIndex((e) => e.sessionId === s.id && e.type === 'release');
    if (relIdx >= 0) {
      const rel = db.ledger[relIdx]!;
      db.ledger[relIdx] = {
        ...rel,
        status: 'posted',
        createdAt: nowIso,
        memo: `Enseñaste «${activity?.title ?? 'Sesión'}» (verificado con QR en 2 etapas)`,
      };
    } else if (s.instructorId === db.CURRENT_USER_ID && creditAmount > 0) {
      db.ledger.unshift({
        id: `tx-rel-${Date.now()}`,
        type: 'release',
        amount: creditAmount,
        sessionId: s.id,
        idempotencyKey: `release:${s.id}`,
        memo: `Enseñaste «${activity?.title ?? 'Sesión'}» (verificado con QR en 2 etapas)`,
        createdAt: nowIso,
        status: 'posted',
      });
    }

    // 3. Increment completedSessions and communityContributions for both participants
    for (const pid of [s.learnerId, s.instructorId]) {
      const pIdx = db.profiles.findIndex((p) => p.id === pid);
      if (pIdx >= 0) {
        const p = db.profiles[pIdx]!;
        db.profiles[pIdx] = {
          ...p,
          completedSessions: p.completedSessions + 1,
          communityContributions: p.communityContributions + 1,
        };
      }
    }

    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: db.CURRENT_USER_ID,
      type: creditAmount > 0 ? 'credit_released' : 'session_completed',
      title: 'Sesión completada y verificada',
      body:
        creditAmount > 0
          ? `Se verificó el cierre de «${activity?.title ?? 'Sesión'}» y se liberaron ${creditAmount} crédito(s) de la custodia.`
          : `Se verificó el cierre de «${activity?.title ?? 'Sesión'}». ¡Ya podés dejar tu reseña verificada!`,
      sessionId: s.id,
      createdAt: nowIso,
    });

    return {
      session: updated,
      releasedCredits: creditAmount,
      message:
        creditAmount > 0
          ? `Check-out verificado (Etapa 2/2). ¡Sesión completada! Se liberaron de forma atómica ${creditAmount} crédito(s) al instructor.`
          : 'Check-out verificado (Etapa 2/2). ¡Sesión completada!',
    };
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

  async listReviewsBySession(sessionId) {
    await delay(100);
    return db.reviews.filter((r) => r.sessionId === sessionId);
  },

  async submitReview(userId, input) {
    await delay(200);
    const s = db.sessions.find((x) => x.id === input.sessionId);
    if (!s) throw new Error('Sesión no encontrada.');
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error('Solo los participantes de la sesión pueden dejar una reseña.');
    }
    if (s.state !== 'completed') {
      throw new Error('Solo se pueden reseñar sesiones completadas y verificadas.');
    }
    const existing = db.reviews.find((r) => r.sessionId === s.id && r.authorId === userId);
    if (existing) {
      throw new Error('Ya publicaste una reseña verificada para esta sesión.');
    }
    const comment = input.comment.trim();
    if (comment.length < 4) {
      throw new Error('Escribí un breve comentario sobre la experiencia (al menos 4 caracteres).');
    }

    const subjectId = s.instructorId === userId ? s.learnerId : s.instructorId;
    const nowIso = new Date().toISOString();
    const created: Review = {
      id: `r-${Date.now()}`,
      sessionId: s.id,
      authorId: userId,
      subjectId,
      rating: input.rating,
      comment,
      createdAt: nowIso,
    };
    db.reviews.unshift(created);

    // Update recipient profile ratingAvg and ratingCount
    const pIdx = db.profiles.findIndex((p) => p.id === subjectId);
    if (pIdx >= 0) {
      const subjectReviews = db.reviews.filter((r) => r.subjectId === subjectId);
      const avg =
        Math.round((subjectReviews.reduce((acc, r) => acc + r.rating, 0) / subjectReviews.length) * 10) / 10;
      db.profiles[pIdx] = {
        ...db.profiles[pIdx]!,
        ratingAvg: avg,
        ratingCount: subjectReviews.length,
      };
    }

    return created;
  },

  async listNotifications(userId) {
    await delay(100);
    return db.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async markAllNotificationsRead(userId) {
    await delay(100);
    const nowIso = new Date().toISOString();
    for (let i = 0; i < db.notifications.length; i++) {
      const n = db.notifications[i]!;
      if (n.userId === userId && !n.readAt) {
        db.notifications[i] = { ...n, readAt: nowIso };
      }
    }
  },

  async listDisputes() {
    await delay(120);
    return [...db.disputes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async resolveDispute(moderatorId, input) {
    await delay(200);
    const idx = db.disputes.findIndex((d) => d.id === input.disputeId);
    if (idx < 0) throw new Error('Disputa no encontrada.');
    const d = db.disputes[idx]!;
    if (d.status !== 'open') {
      throw new Error('Esta disputa ya fue resuelta.');
    }

    const note = input.resolutionNote.trim() || 'Resuelta por moderación comunitaria';
    const nowIso = new Date().toISOString();
    const updatedDispute: DisputeRecord = {
      ...d,
      status: input.resolution,
      resolutionNote: note,
      resolvedBy: moderatorId,
      resolvedAt: nowIso,
    };
    db.disputes[idx] = updatedDispute;

    const sesIdx = db.sessions.findIndex((s) => s.id === d.sessionId);
    if (sesIdx >= 0) {
      db.sessions[sesIdx] = {
        ...db.sessions[sesIdx]!,
        state: 'resolved',
      };
    }

    // Settle any pending hold in the ledger according to the resolution
    const holdIdx = db.ledger.findIndex(
      (e) => e.sessionId === d.sessionId && e.type === 'hold' && e.status === 'pending',
    );
    if (holdIdx >= 0) {
      const hold = db.ledger[holdIdx]!;
      const absAmount = Math.abs(hold.amount);
      db.ledger[holdIdx] = { ...hold, status: 'posted' };

      if (input.resolution === 'resolved_refund') {
        db.ledger.unshift({
          id: `tx-disp-ref-${Date.now()}`,
          type: 'refund',
          amount: absAmount,
          sessionId: d.sessionId,
          idempotencyKey: `refund:dispute:${d.id}`,
          memo: `Reintegro 100% por resolución de disputa: ${note}`,
          createdAt: nowIso,
          status: 'posted',
        });
      } else if (input.resolution === 'resolved_split') {
        const half = Math.round((absAmount / 2) * 100) / 100;
        db.ledger.unshift({
          id: `tx-disp-split-${Date.now()}`,
          type: 'refund',
          amount: half,
          sessionId: d.sessionId,
          idempotencyKey: `refund:dispute:${d.id}`,
          memo: `Reintegro parcial (50%) por acuerdo de moderación: ${note}`,
          createdAt: nowIso,
          status: 'posted',
        });
      }
    }

    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: db.CURRENT_USER_ID,
      type: 'dispute_resolved',
      title: 'Revisión administrativa completada',
      body: `Se resolvió el caso de «${d.activityTitle}»: ${note}`,
      sessionId: d.sessionId,
      actorId: moderatorId,
      createdAt: nowIso,
    });

    return updatedDispute;
  },

  async listSafetyReports() {
    await delay(100);
    return [...db.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async resolveSafetyReport(_moderatorId, input) {
    await delay(150);
    const idx = db.reports.findIndex((r) => r.id === input.reportId);
    if (idx < 0) throw new Error('Reporte no encontrado.');
    const updated: SafetyReportRecord = {
      ...db.reports[idx]!,
      status: input.status,
    };
    db.reports[idx] = updated;
    return updated;
  },

  async reportOrBlockUser(userId, input) {
    await delay(200);
    if (input.blockUser) {
      getBlockedSet(userId).add(input.targetUserId);
    }
    if (input.reason.trim()) {
      db.reports.unshift({
        id: `rep-${Date.now()}`,
        reporterId: userId,
        targetUserId: input.targetUserId,
        reason: input.reason.trim(),
        status: 'open',
        createdAt: new Date().toISOString(),
      });
    }
  },

  async listBlockedUserIds(userId) {
    await delay(100);
    return Array.from(getBlockedSet(userId));
  },
};
