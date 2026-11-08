/**
 * In-memory repository backed by src/mocks/data.ts. DEMO ONLY: it simulates
 * network latency, but nothing is persisted and no real credits move.
 *
 * The recommendation scoring mirrors the planned Postgres function
 * `recommended_activities` (docs/ARCHITECTURE.md §8), so ranking behaviour can be
 * validated in the UI before the backend exists.
 */
import { categoryOfSkill, skillName } from '../domain/catalog';
import type { ActivityRecommendation, CreditWallet, MatchKind } from '../domain/types';
import * as db from '../mocks/data';
import type { Repository } from './repository';

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const MAX_BALANCE = 20;

export const mockRepository: Repository = {
  kind: 'mock',

  async getCurrentUserId() {
    return db.CURRENT_USER_ID;
  },

  async getProfile(id) {
    await delay();
    return db.profiles.find((p) => p.id === id) ?? null;
  },

  async listActivities(filters = {}) {
    await delay();
    const q = filters.query?.trim().toLowerCase();
    return db.activities.filter((a) => {
      if (a.status !== 'published') return false;
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
    const myOffers = new Set(me.skills.filter((s) => s.kind === 'offers').map((s) => s.skillId));
    const myWants = new Set(me.skills.filter((s) => s.kind === 'wants').map((s) => s.skillId));

    const recs: ActivityRecommendation[] = [];
    for (const activity of db.activities) {
      if (activity.status !== 'published' || activity.instructorId === userId) continue;
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

  async getWallet(): Promise<CreditWallet> {
    await delay();
    const entries = [...db.ledger].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const posted = entries.filter((e) => e.status === 'posted');
    const pending = entries.filter((e) => e.status === 'pending');
    const sum = (xs: typeof entries) => xs.reduce((acc, e) => acc + e.amount, 0);

    // Pending holds have already left the available balance (they sit in escrow).
    const pendingHolds = pending.filter((e) => e.type === 'hold');
    const heldInEscrow = -sum(pendingHolds);
    const available = sum(posted) - heldInEscrow;
    const incomingPending = sum(pending.filter((e) => e.amount > 0));
    const earnedTotal = sum(posted.filter((e) => e.type === 'release'));
    const spentTotal =
      -sum(posted.filter((e) => e.type === 'hold' || e.type === 'penalty')) -
      sum(posted.filter((e) => e.type === 'refund'));

    return { available, heldInEscrow, incomingPending, earnedTotal, spentTotal, maxBalance: MAX_BALANCE, entries };
  },

  async listReviewsAbout(userId) {
    await delay();
    return db.reviews.filter((r) => r.subjectId === userId);
  },
};
