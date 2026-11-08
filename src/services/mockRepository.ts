/**
 * In-memory repository backed by src/mocks/data.ts. DEMO ONLY: it simulates
 * network latency and in-session mutations (onboarding, profile edits, booking
 * requests with credit escrow holds, and blocking users), but nothing is persisted
 * across app restarts.
 */
import { categoryOfSkill, skillName } from '../domain/catalog';
import type {
  ActivityRecommendation,
  CreditWallet,
  ID,
  MatchKind,
  ProfileStatus,
  Session,
} from '../domain/types';
import * as db from '../mocks/data';
import type { Repository } from './repository';

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const MAX_BALANCE = 20;
const MIN_PILOT_AGE = 18;

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

export const mockRepository: Repository = {
  kind: 'mock',

  async getCurrentUserId() {
    return db.CURRENT_USER_ID;
  },

  async getProfile(id) {
    await delay();
    const p = db.profiles.find((x) => x.id === id);
    return p ? { ...p, skills: [...p.skills] } : null;
  },

  async updateProfile(userId, input) {
    await delay(250);
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

  async submitEligibility(userId, input) {
    await delay(250);
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
    const q = filters.query?.trim().toLowerCase();
    return db.activities.filter((a) => {
      if (a.status !== 'published') return false;
      if (blocked.has(a.instructorId)) return false;
      if (filters.categoryId && categoryOfSkill(a.skillId)?.id !== filters.categoryId) return false;
      if (filters.paymentMode && a.payment.mode !== filters.paymentMode) return false;
      if (filters.neighborhoodId) {
        const instructor = db.profiles.find((p) => p.id === a.instructorId);
        if (instructor?.neighborhoodId !== filters.neighborhoodId) return false;
      }
      if (q) {
        const haystack = `${a.title} ${a.description} ${skillName(a.skillId)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  },

  async listActivitiesByInstructor(instructorId) {
    await delay();
    return db.activities.filter((a) => a.instructorId === instructorId);
  },

  async getActivity(id) {
    await delay();
    return db.activities.find((a) => a.id === id) ?? null;
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
        memo: `${activity.title}: retenido en custodia hasta completar la sesión`,
        createdAt: new Date().toISOString(),
        status: 'pending',
      });
    }

    return newSession;
  },

  async getWallet(): Promise<CreditWallet> {
    await delay();
    return computeWallet();
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
