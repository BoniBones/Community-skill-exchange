/**
 * In-memory repository backed by src/mocks/data.ts. DEMO ONLY: it simulates
 * network latency and in-session mutations (onboarding, profile edits, activity
 * publishing with integer time-credits, availability windows, booking
 * requests with credit escrow holds, session confirm/decline/cancel, and blocking
 * users), but nothing is persisted across app restarts.
 */
import {
  CATEGORIES,
  categoryName,
  categoryOfSkill,
  getSkill,
  NEIGHBORHOODS,
  registerCustomSkill,
  SKILLS,
  skillName,
} from '../domain/catalog';
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
  ProfileStatus,
  Review,
  SafetyReportRecord,
  Session,
  SessionVerificationToken,
  Skill,
} from '../domain/types';
import { verifySaltedSha256 } from '../lib/crypto';
import { isValidBirthDate } from '../lib/dates';
import { formatCredits } from '../lib/format';
import { getActiveLocale, t, type SupportedLocale } from '../lib/i18n';
import { validateProfilePhotoAsset } from '../lib/profilePhoto';
import * as db from '../mocks/data';
import type { Repository } from './repository';

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const MAX_BALANCE = 20;
const MIN_PILOT_AGE = 18;
const CANCELLATION_DEADLINE_HOURS = 24;
const OBJECTION_WINDOW_HOURS = 48;
const QR_TOKEN_TTL_SECONDS = 90;

export const SAFETY_POLICY_CONSTANTS = {
  maxBalance: MAX_BALANCE,
  minPilotAge: MIN_PILOT_AGE,
  cancellationDeadlineHours: CANCELLATION_DEADLINE_HOURS,
  objectionWindowHours: OBJECTION_WINDOW_HOURS,
  qrTokenTtlSeconds: QR_TOKEN_TTL_SECONDS,
} as const;

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

function validateCreditAmount(creditAmount: number): number {
  if (!Number.isInteger(creditAmount) || creditAmount < 1) {
    throw new Error(t('repoErrInvalidCredits'));
  }
  return creditAmount;
}

function getWeekdayPluralName(day: number, locale: SupportedLocale): string {
  const keys = [
    'weekdayPlural0',
    'weekdayPlural1',
    'weekdayPlural2',
    'weekdayPlural3',
    'weekdayPlural4',
    'weekdayPlural5',
    'weekdayPlural6',
  ] as const;
  return t(keys[day] ?? 'weekdayPlural0', locale);
}

function getPeriodShortName(period: DayPeriod, locale: SupportedLocale): string {
  switch (period) {
    case 'morning':
      return t('periodMorningShort', locale);
    case 'afternoon':
      return t('periodAfternoonShort', locale);
    case 'evening':
      return t('periodEveningShort', locale);
  }
}

export function summarizeAvailability(
  windows: AvailabilityWindow[],
  customNote?: string,
  locale: SupportedLocale = getActiveLocale(),
): string {
  if (windows.length === 0) {
    return customNote?.trim() || t('commonToCoordinate', locale);
  }
  const byDay = new Map<number, DayPeriod[]>();
  for (const w of windows) {
    const list = byDay.get(w.weekday) ?? [];
    if (!list.includes(w.period)) list.push(w.period);
    byDay.set(w.weekday, list);
  }
  const parts: string[] = [];
  for (const [day, periods] of Array.from(byDay.entries()).sort((a, b) => a[0] - b[0])) {
    parts.push(`${getWeekdayPluralName(day, locale)} (${periods.map((p) => getPeriodShortName(p, locale)).join(', ')})`);
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
  const heldInEscrow = -sum(pendingHolds) || 0;
  const available = sum(posted) - heldInEscrow || 0;
  const incomingPending = sum(pending.filter((e) => e.amount > 0)) || 0;
  const earnedTotal = sum(posted.filter((e) => e.type === 'release')) || 0;
  const spentTotal =
    (-sum(posted.filter((e) => e.type === 'hold' || e.type === 'penalty')) -
      sum(posted.filter((e) => e.type === 'refund'))) ||
    0;

  return { available, heldInEscrow, incomingPending, earnedTotal, spentTotal, maxBalance: MAX_BALANCE, entries };
}

export function verifyWalletInvariants(
  wallet: CreditWallet,
  sessions: Session[],
): LedgerIntegrityReport {
  const posted = wallet.entries.filter((e) => e.status === 'posted');
  const incentivesTotal = posted.filter((e) => e.type === 'incentive').reduce((acc, e) => acc + e.amount, 0);
  const adjustmentsTotal = posted.filter((e) => e.type === 'adjustment').reduce((acc, e) => acc + e.amount, 0);

  // Invariant 1: Non-negative user balance
  const nonNegative = wallet.available >= 0;

  // Invariant 2: Double-entry conservation equation
  // available + heldInEscrow === incentives + earnedTotal + adjustments - spentTotal
  const lhs = wallet.available + wallet.heldInEscrow;
  const rhs = incentivesTotal + wallet.earnedTotal + adjustmentsTotal - wallet.spentTotal;
  const conservation = Number.isInteger(lhs) && Number.isInteger(rhs) && lhs === rhs;

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

  // Invariant 5: Integer-only, non-cashable time-credits
  const integerEntries = wallet.entries.every((e) => Number.isInteger(e.amount) && e.amount !== 0);
  const integerBalances =
    Number.isInteger(wallet.available) &&
    Number.isInteger(wallet.heldInEscrow) &&
    Number.isInteger(wallet.incomingPending);
  const integerSessions = sessions.every((s) => Number.isInteger(s.creditAmount) && s.creditAmount >= 1);
  const integerOnlyNonCashable = integerEntries && integerBalances && integerSessions;

  const invariants: LedgerInvariantCheck[] = [
    {
      id: 'non_negative_balance',
      name: t('invNonNegName'),
      passed: nonNegative,
      detail: t('invNonNegDetail', { available: wallet.available }),
    },
    {
      id: 'double_entry_conservation',
      name: t('invConsName'),
      passed: conservation,
      detail: t('invConsDetail', {
        available: wallet.available,
        held: wallet.heldInEscrow,
        incentives: incentivesTotal,
        earned: wallet.earnedTotal,
        spent: wallet.spentTotal,
      }),
    },
    {
      id: 'escrow_session_parity',
      name: t('invEscrowName'),
      passed: escrowMatchesSessions,
      detail: t('invEscrowDetail', { count: pendingHolds.length }),
    },
    {
      id: 'idempotency_uniqueness',
      name: t('invIdempName'),
      passed: idempotent,
      detail: t('invIdempDetail', { keys: uniqueKeys.size, incentives: incentiveCount }),
    },
    {
      id: 'integer_only_non_cashable_credits',
      name: t('invIntName'),
      passed: integerOnlyNonCashable,
      detail: t('invIntDetail', { entries: wallet.entries.length, sessions: sessions.length }),
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

  async listSkills() {
    await delay(60);
    for (const custom of db.customSkills) {
      registerCustomSkill(custom);
    }
    return [...SKILLS, ...db.customSkills].map((s) => ({ ...s }));
  },

  async createCustomSkill(userId, input) {
    await delay(150);
    const trimmedName = input.name.trim();
    if (trimmedName.length < 2) {
      throw new Error(t('repoErrCustomSkillName'));
    }
    if (!CATEGORIES.some((c) => c.id === input.categoryId)) {
      throw new Error(t('repoErrCustomSkillCat'));
    }
    const foldSkillName = (value: string) =>
      value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedName = foldSkillName(trimmedName);
    const existing = [...SKILLS, ...db.customSkills].find(
      (s) =>
        s.categoryId === input.categoryId &&
        (foldSkillName(s.name) === normalizedName ||
          (s.nameEn ? foldSkillName(s.nameEn) === normalizedName : false)),
    );
    if (existing) {
      if (existing.isCustom) registerCustomSkill(existing);
      return { ...existing };
    }

    const trimmedDesc = input.description?.trim() || undefined;
    const created: Skill = {
      id: `s-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      categoryId: input.categoryId,
      name: trimmedName,
      nameEn: trimmedName,
      description: trimmedDesc,
      isCustom: true,
      createdBy: userId,
    };
    db.customSkills.push(created);
    registerCustomSkill(created);
    return { ...created };
  },

  async listNeighborhoods() {
    await delay(60);
    return NEIGHBORHOODS.map((n) => ({ ...n }));
  },

  async verifyNeighborhoodAccess(userId, input) {
    await delay(180);
    const neighborhood = NEIGHBORHOODS.find((n) => n.id === input.neighborhoodId);
    const record = db.NEIGHBORHOOD_ACCESS_RECORDS.find((r) => r.neighborhoodId === input.neighborhoodId);
    if (!neighborhood || !record) {
      throw new Error(t('repoErrNeighborhoodNotFound'));
    }
    if (!neighborhood.isActive || !record.isActive) {
      throw new Error(t('repoErrNeighborhoodInactive', { name: neighborhood.name }));
    }
    const code = input.accessCode.trim();
    if (!code) {
      throw new Error(t('repoErrNeighborhoodCodeRequired'));
    }
    if (!record.codeHash || !verifySaltedSha256(neighborhood.id, code, record.salt, record.codeHash)) {
      throw new Error(t('repoErrNeighborhoodCodeInvalid'));
    }

    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx < 0) throw new Error(t('repoErrProfileNotFound'));
    const verifiedAt = new Date().toISOString();
    const updated = {
      ...db.profiles[idx]!,
      neighborhoodId: neighborhood.id,
      neighborhoodVerifiedAt: verifiedAt,
    };
    db.profiles[idx] = updated;
    return {
      ...updated,
      skills: [...updated.skills],
      availabilityWindows: updated.availabilityWindows ? [...updated.availabilityWindows] : undefined,
    };
  },

  async listProfiles() {
    await delay(80);
    return db.profiles.map((p) => ({
      ...p,
      skills: [...p.skills],
      availabilityWindows: p.availabilityWindows ? [...p.availabilityWindows] : undefined,
    }));
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
    if (idx < 0) throw new Error(t('repoErrProfileNotFound'));
    const current = db.profiles[idx]!;
    const nextAvatarUrl =
      input.avatarUrl === null
        ? undefined
        : typeof input.avatarUrl === 'string'
          ? input.avatarUrl.trim() || undefined
          : current.avatarUrl;
    const nextVerifiedAt =
      input.neighborhoodVerifiedAt !== undefined ? input.neighborhoodVerifiedAt : current.neighborhoodVerifiedAt;

    const updated = {
      ...current,
      displayName: input.displayName.trim(),
      neighborhoodId: input.neighborhoodId,
      neighborhoodVerifiedAt: nextVerifiedAt,
      avatarUrl: nextAvatarUrl,
      bio: input.bio.trim(),
      availabilitySummary: input.availabilitySummary.trim(),
      skills: [...input.skills],
      status: 'active' as ProfileStatus,
    };
    db.profiles[idx] = updated;
    return { ...updated, skills: [...updated.skills] };
  },

  async uploadProfilePhoto(userId, asset) {
    await delay(220);
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx < 0) throw new Error(t('repoErrProfileNotFound'));
    const validation = validateProfilePhotoAsset(asset);
    if (!validation.valid) {
      throw new Error(t(validation.errorKey));
    }
    const cleanUri = asset.uri.trim();
    db.profiles[idx] = {
      ...db.profiles[idx]!,
      avatarUrl: cleanUri,
    };
    return cleanUri;
  },

  async removeProfilePhoto(userId) {
    await delay(150);
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx < 0) throw new Error(t('repoErrProfileNotFound'));
    db.profiles[idx] = {
      ...db.profiles[idx]!,
      avatarUrl: undefined,
    };
  },

  async updateAvailability(userId, input) {
    await delay(200);
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx < 0) throw new Error(t('repoErrProfileNotFound'));
    const customNote = input.customNote?.trim() || undefined;
    const summary = summarizeAvailability(input.windows, customNote);
    const updated = {
      ...db.profiles[idx]!,
      availabilityWindows: [...input.windows],
      availabilityNote: customNote,
      availabilitySummary: summary,
    };
    db.profiles[idx] = updated;
    return { ...updated, skills: [...updated.skills], availabilityWindows: [...input.windows] };
  },

  async submitEligibility(userId, input) {
    await delay(200);
    if (!isValidBirthDate(input.birthYear, input.birthMonth, input.birthDay)) {
      throw new Error(t('eligInvalidDate'));
    }
    const age = calculateAge(input.birthYear, input.birthMonth, input.birthDay);
    if (!input.acceptedSafetyRules) {
      return {
        status: 'pending_eligibility',
        age,
        eligible: false,
        message: t('repoErrEligAcceptRules'),
      };
    }
    if (age < 13) {
      return {
        status: 'restricted',
        age,
        eligible: false,
        message: t('repoErrEligUnder13'),
      };
    }
    if (age < MIN_PILOT_AGE) {
      return {
        status: 'restricted',
        age,
        eligible: false,
        message: t('repoErrEligMinorPilot'),
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
      message: t('repoEligVerified'),
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
      if (filters.format && a.format !== 'either' && a.format !== filters.format) return false;

      const instructor = db.profiles.find((p) => p.id === a.instructorId);
      if (filters.neighborhoodId && instructor?.neighborhoodId !== filters.neighborhoodId) return false;

      if (filters.onlyReciprocal) {
        if (a.instructorId === db.CURRENT_USER_ID || !instructor) return false;
        const hasReciprocal = instructor.skills.some((s) => s.kind === 'wants' && myOffers.has(s.skillId));
        if (!hasReciprocal) return false;
      }

      if (q) {
        const skill = getSkill(a.skillId);
        const cat = categoryOfSkill(a.skillId);
        const catEs = cat ? categoryName(cat.id, 'es-AR') : '';
        const catEn = cat ? categoryName(cat.id, 'en') : '';
        const haystack = `${a.title} ${a.description} ${skillName(a.skillId, 'es-AR')} ${skillName(a.skillId, 'en')} ${skill?.description ?? ''} ${catEs} ${catEn} ${instructor?.displayName ?? ''}`.toLowerCase();
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
    if (title.length < 4) throw new Error(t('repoErrTitleMin'));
    if (description.length < 10) throw new Error(t('repoErrDescMin'));
    if (meetingArea.length < 3) throw new Error(t('repoErrMeetingArea'));
    if (/mi casa|domicilio particular|depto|departamento/i.test(meetingArea)) {
      throw new Error(t('repoErrPrivateAddress'));
    }

    const creditAmount = validateCreditAmount(input.creditAmount);

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
      if (idx < 0) throw new Error(t('repoErrActivityNotFound'));
      const updated: Activity = {
        ...db.activities[idx]!,
        skillId: input.skillId,
        title,
        description,
        durationMin: input.durationMin,
        format: input.format,
        meetingArea,
        requirements: input.requirements.trim() || t('commonNone'),
        availabilitySummary: input.availabilitySummary.trim() || t('commonToCoordinate'),
        creditAmount,
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
      requirements: input.requirements.trim() || t('commonNone'),
      availabilitySummary: input.availabilitySummary.trim() || t('commonToCoordinate'),
      creditAmount,
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
        memo: t('repoIncentiveMemo'),
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
    if (!activity) throw new Error(t('repoErrActivityNotFound'));
    if (activity.instructorId === userId) {
      throw new Error(t('repoErrBookOwn'));
    }

    const creditCost = validateCreditAmount(activity.creditAmount);
    const wallet = computeWallet();
    if (wallet.available < creditCost) {
      throw new Error(
        t('repoErrInsufficientCredits', {
          cost: formatCredits(creditCost),
          available: formatCredits(wallet.available),
        }),
      );
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
      creditAmount: creditCost,
      learnerNote: input.learnerNote?.trim() || undefined,
    };
    db.sessions.unshift(newSession);

    db.ledger.unshift({
      id: `tx-${Date.now()}`,
      type: 'hold',
      amount: -creditCost,
      sessionId: newSession.id,
      idempotencyKey: `hold:${newSession.id}`,
      memo: t('repoHoldMemo', { title: activity.title }),
      createdAt: nowIso,
      status: 'pending',
    });

    return newSession;
  },

  async respondToSession(userId, input) {
    await delay(200);
    const idx = db.sessions.findIndex((s) => s.id === input.sessionId);
    if (idx < 0) throw new Error(t('repoErrSessionNotFound'));
    const s = db.sessions[idx]!;
    if (s.instructorId !== userId) {
      throw new Error(t('repoErrOnlyInstructorRespond'));
    }
    if (s.state !== 'requested') {
      throw new Error(t('repoErrSessionNotPending'));
    }

    if (input.decision === 'confirm') {
      const updated: Session = { ...s, state: 'confirmed' };
      db.sessions[idx] = updated;
      return updated;
    }

    // Declined -> refund held credits
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
        memo: t('repoRefundDeclined'),
        createdAt: new Date().toISOString(),
        status: 'posted',
      });
    }
    const relIdx = db.ledger.findIndex(
      (e) => e.sessionId === s.id && e.type === 'release' && e.status === 'pending',
    );
    if (relIdx >= 0) {
      db.ledger.splice(relIdx, 1);
    }
    return updated;
  },

  async cancelSession(userId, input) {
    await delay(200);
    const idx = db.sessions.findIndex((s) => s.id === input.sessionId);
    if (idx < 0) throw new Error(t('repoErrSessionNotFound'));
    const s = db.sessions[idx]!;
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error(t('repoErrNotParticipant'));
    }
    if (s.state !== 'requested' && s.state !== 'confirmed') {
      throw new Error(t('repoErrCancelState'));
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
      cancellationReason: input.reason.trim() || t('repoDefaultCancelReason'),
      cancellationTiming: isTimely ? 'timely' : 'late_review_window',
      reviewWindowEndsAt,
    };
    db.sessions[idx] = updated;

    if (isTimely) {
      const relIdx = db.ledger.findIndex(
        (e) => e.sessionId === s.id && e.type === 'release' && e.status === 'pending',
      );
      if (relIdx >= 0) {
        db.ledger.splice(relIdx, 1);
      }
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
          memo: cancelledByInstructor ? t('repoRefundInstructorCancel') : t('repoRefundTimelyCancel'),
          createdAt: new Date().toISOString(),
          status: 'posted',
        });
        return {
          session: updated,
          refundMessage: t('repoCancelTimelyMsg', { credits: formatCredits(Math.abs(hold.amount)) }),
        };
      } else {
        // Late cancellation: keep in pending state for the 48h objection / administrative review window
        db.ledger[holdIdx] = {
          ...hold,
          memo: t('repoCancelLateHoldMemo', { memo: hold.memo }),
        };
        return {
          session: updated,
          refundMessage: t('repoCancelLateMsg'),
        };
      }
    }

    return {
      session: updated,
      refundMessage: isTimely ? t('repoCancelTimelyNoHold') : t('repoCancelLateNoHold'),
    };
  },

  async submitCancellationObjection(userId, input) {
    await delay(200);
    const reason = input.reason.trim();
    if (reason.length < 6) {
      throw new Error(t('repoErrObjectionMin'));
    }
    const idx = db.sessions.findIndex((s) => s.id === input.sessionId);
    if (idx < 0) throw new Error(t('repoErrSessionNotFound'));
    const s = db.sessions[idx]!;
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error(t('repoErrNotParticipant'));
    }
    if (db.disputes.some((d) => d.sessionId === s.id && d.status === 'open')) {
      throw new Error(t('repoErrObjectionDuplicate'));
    }
    if (s.state !== 'cancelled' || s.cancellationTiming !== 'late_review_window') {
      throw new Error(t('repoErrObjectionInvalidState'));
    }
    if (s.reviewWindowEndsAt && new Date(s.reviewWindowEndsAt).getTime() < Date.now()) {
      throw new Error(t('repoErrObjectionWindowExpired'));
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
        memo: t('repoObjectionHoldMemo', { base: hold.memo.split(' (')[0] }),
      };
    }

    const activity = db.activities.find((a) => a.id === s.activityId);
    const existingDispute = db.disputes.find((d) => d.sessionId === s.id && d.status === 'open');
    if (!existingDispute) {
      db.disputes.unshift({
        id: `disp-${Date.now()}`,
        sessionId: s.id,
        activityTitle: activity?.title ?? t('repoDefaultCommunitySession'),
        openedBy: userId,
        learnerId: s.learnerId,
        instructorId: s.instructorId,
        creditAmount: s.creditAmount,
        reason,
        status: 'open',
        createdAt: nowIso,
      });
    }

    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: db.CURRENT_USER_ID,
      type: 'dispute_opened',
      title: t('repoNotifDisputeTitle'),
      body: t('repoNotifDisputeBody', { title: activity?.title ?? t('navSession') }),
      sessionId: s.id,
      actorId: userId,
      createdAt: nowIso,
    });

    return updated;
  },

  async issueSessionToken(userId, input) {
    await delay(150);
    const s = db.sessions.find((x) => x.id === input.sessionId);
    if (!s) throw new Error(t('repoErrSessionNotFound'));
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error(t('repoErrQrParticipantsOnly'));
    }
    if (input.phase === 'check_in' && s.state !== 'confirmed') {
      throw new Error(t('repoErrQrNeedConfirmed'));
    }
    if (input.phase === 'check_out' && s.state !== 'in_progress') {
      throw new Error(t('repoErrQrNeedInProgress'));
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
    if (idx < 0) throw new Error(t('repoErrSessionNotFound'));
    const s = db.sessions[idx]!;
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error(t('repoErrNotParticipant'));
    }

    const normalizedCode = input.code.trim().toUpperCase();
    if (normalizedCode.length < 4) {
      throw new Error(t('repoErrQrCodeFormat'));
    }

    const tokIdx = db.verificationTokens.findIndex(
      (tok) => tok.sessionId === s.id && tok.phase === input.phase && tok.code === normalizedCode && !tok.usedAt,
    );
    if (tokIdx < 0) {
      throw new Error(t('repoErrQrInvalidOrUsed'));
    }
    const tok = db.verificationTokens[tokIdx]!;
    if (new Date(tok.expiresAt).getTime() < Date.now()) {
      throw new Error(t('repoErrQrExpired'));
    }
    if (tok.issuerId === userId) {
      throw new Error(t('repoErrQrSelfRedeem'));
    }
    if (input.phase !== 'check_in' && input.phase !== 'check_out') {
      throw new Error(t('repoErrQrInvalidOrUsed'));
    }
    if (input.phase === 'check_in' && s.state !== 'confirmed') {
      throw new Error(t('repoErrQrCheckInState'));
    }
    if (input.phase === 'check_out' && s.state !== 'in_progress') {
      throw new Error(t('repoErrQrNeedCheckInFirst'));
    }

    const nowIso = new Date().toISOString();
    db.verificationTokens[tokIdx] = {
      ...tok,
      usedAt: nowIso,
      usedBy: userId,
    };

    const activity = db.activities.find((a) => a.id === s.activityId);

    if (input.phase === 'check_in') {
      const updated: Session = {
        ...s,
        state: 'in_progress',
        checkedInAt: nowIso,
      };
      db.sessions[idx] = updated;
      return {
        session: updated,
        releasedCredits: 0,
        message: t('repoQrCheckInMsg'),
      };
    }

    // Phase 2: check_out -> complete session and atomically release credit escrow
    const updated: Session = {
      ...s,
      state: 'completed',
      checkedOutAt: nowIso,
    };
    db.sessions[idx] = updated;

    const creditAmount = s.creditAmount;

    // 1. If viewer is learner, settle their pending 'hold' -> 'posted'
    const holdIdx = db.ledger.findIndex((e) => e.sessionId === s.id && e.type === 'hold' && e.status === 'pending');
    if (holdIdx >= 0) {
      const hold = db.ledger[holdIdx]!;
      db.ledger[holdIdx] = {
        ...hold,
        status: 'posted',
        memo: t('repoQrHoldSettledMemo', { title: activity?.title ?? t('navSession') }),
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
        memo: t('repoQrReleaseMemo', { title: activity?.title ?? t('navSession') }),
      };
    } else if (s.instructorId === db.CURRENT_USER_ID && creditAmount > 0) {
      db.ledger.unshift({
        id: `tx-rel-${Date.now()}`,
        type: 'release',
        amount: creditAmount,
        sessionId: s.id,
        idempotencyKey: `release:${s.id}`,
        memo: t('repoQrReleaseMemo', { title: activity?.title ?? t('navSession') }),
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
      title: t('repoNotifCompletedTitle'),
      body:
        creditAmount > 0
          ? t('repoNotifCompletedBodyCredits', {
              title: activity?.title ?? t('navSession'),
              credits: formatCredits(creditAmount),
            })
          : t('repoNotifCompletedBodyReview', { title: activity?.title ?? t('navSession') }),
      sessionId: s.id,
      createdAt: nowIso,
    });

    return {
      session: updated,
      releasedCredits: creditAmount,
      message:
        creditAmount > 0
          ? t('repoQrCheckOutMsgCredits', { credits: formatCredits(creditAmount) })
          : t('repoQrCheckOutMsgSimple'),
    };
  },

  async getWallet(): Promise<CreditWallet> {
    await delay();
    return computeWallet();
  },

  async getLedgerIntegrity(): Promise<LedgerIntegrityReport> {
    await delay(100);
    const wallet = computeWallet();
    return verifyWalletInvariants(wallet, db.sessions);
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
    if (!s) throw new Error(t('repoErrSessionNotFound'));
    if (s.learnerId !== userId && s.instructorId !== userId) {
      throw new Error(t('repoErrReviewParticipantsOnly'));
    }
    if (s.state !== 'completed') {
      throw new Error(t('repoErrReviewCompletedOnly'));
    }
    const existing = db.reviews.find((r) => r.sessionId === s.id && r.authorId === userId);
    if (existing) {
      throw new Error(t('repoErrReviewDuplicate'));
    }
    const comment = input.comment.trim();
    if (comment.length < 4) {
      throw new Error(t('repoErrReviewCommentMin'));
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
    if (input.resolution !== 'resolved_refund' && input.resolution !== 'resolved_release') {
      throw new Error(t('repoErrInvalidDisputeResolution'));
    }

    const idx = db.disputes.findIndex((d) => d.id === input.disputeId);
    if (idx < 0) throw new Error(t('repoErrDisputeNotFound'));
    const d = db.disputes[idx]!;
    if (d.status !== 'open') {
      throw new Error(t('repoErrDisputeAlreadyResolved'));
    }

    const note = input.resolutionNote.trim() || t('repoDefaultModerationNote');
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
    const ses = sesIdx >= 0 ? db.sessions[sesIdx] : undefined;
    if (sesIdx >= 0) {
      db.sessions[sesIdx] = {
        ...db.sessions[sesIdx]!,
        state: 'resolved',
      };
    }

    // Settle any pending hold and/or pending release in the ledger independently
    const holdIdx = db.ledger.findIndex(
      (e) => e.sessionId === d.sessionId && e.type === 'hold' && e.status === 'pending',
    );
    const initialRelIdx = db.ledger.findIndex(
      (e) => e.sessionId === d.sessionId && e.type === 'release' && e.status === 'pending',
    );
    const absAmount =
      holdIdx >= 0
        ? Math.abs(db.ledger[holdIdx]!.amount)
        : initialRelIdx >= 0
          ? Math.abs(db.ledger[initialRelIdx]!.amount)
          : d.creditAmount || ses?.creditAmount || 1;

    if (holdIdx >= 0) {
      const hold = db.ledger[holdIdx]!;
      db.ledger[holdIdx] = { ...hold, status: 'posted' };

      if (input.resolution === 'resolved_refund') {
        db.ledger.unshift({
          id: `tx-disp-ref-${Date.now()}`,
          type: 'refund',
          amount: absAmount,
          sessionId: d.sessionId,
          idempotencyKey: `refund:dispute:${d.id}`,
          memo: t('repoDisputeRefundMemo', { note }),
          createdAt: nowIso,
          status: 'posted',
        });
      }
    }

    const relIdx = db.ledger.findIndex(
      (e) => e.sessionId === d.sessionId && e.type === 'release' && e.status === 'pending',
    );

    if (input.resolution === 'resolved_release') {
      if (relIdx >= 0) {
        const rel = db.ledger[relIdx]!;
        db.ledger[relIdx] = {
          ...rel,
          status: 'posted',
          createdAt: nowIso,
          memo: t('repoDisputeReleaseMemo', { note }),
        };
      } else if (d.instructorId === db.CURRENT_USER_ID) {
        db.ledger.unshift({
          id: `tx-disp-rel-${Date.now()}`,
          type: 'release',
          amount: absAmount,
          sessionId: d.sessionId,
          idempotencyKey: `release:dispute:${d.id}`,
          memo: t('repoDisputeReleaseMemo', { note }),
          createdAt: nowIso,
          status: 'posted',
        });
      }
    } else if (input.resolution === 'resolved_refund' && relIdx >= 0) {
      db.ledger.splice(relIdx, 1);
    }

    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: db.CURRENT_USER_ID,
      type: 'dispute_resolved',
      title: t('repoNotifDisputeResolvedTitle'),
      body: t('repoNotifDisputeResolvedBody', { title: d.activityTitle, note }),
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
    if (idx < 0) throw new Error(t('repoErrReportNotFound'));
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
