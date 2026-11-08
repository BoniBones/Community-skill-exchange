/**
 * Domain types. They mirror the relational schema in docs/ARCHITECTURE.md (§3)
 * so the mock repository and the future Supabase repository share one contract.
 *
 * Keep the core distinction explicit:
 *  - UserSkill  → a skill a person HAS (offers) or WANTS to learn
 *  - Activity   → a concrete listing a person OFFERS
 *  - Session    → a booking that results from an activity
 */

export type ID = string;
/** ISO-8601 timestamp in UTC (e.g. "2026-11-12T21:00:00Z"). Converted to Buenos Aires time only for display. */
export type UtcTimestamp = string;

export type CategoryId =
  | 'music_arts'
  | 'languages'
  | 'academic'
  | 'tech'
  | 'sports'
  | 'crafts'
  | 'personal'
  | 'community';

export interface SkillCategory {
  id: CategoryId;
  name: string;
  icon: string; // Ionicons glyph name
  color: string;
}

export interface Skill {
  id: ID;
  categoryId: CategoryId;
  name: string;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface UserSkill {
  skillId: ID;
  kind: 'offers' | 'wants';
  level?: SkillLevel;
}

export interface Neighborhood {
  id: ID;
  name: string;
}

export type ProfileStatus = 'pending_eligibility' | 'active' | 'restricted' | 'suspended';

export type DayPeriod = 'morning' | 'afternoon' | 'evening';

/** Recurring weekly availability window in America/Argentina/Buenos_Aires. */
export interface AvailabilityWindow {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Domingo, 1 = Lunes ... 6 = Sábado
  period: DayPeriod;
}

export interface Profile {
  id: ID;
  displayName: string;
  avatarUrl?: string;
  neighborhoodId: ID;
  bio: string;
  memberSince: UtcTimestamp;
  skills: UserSkill[];
  availabilitySummary: string;
  availabilityWindows?: AvailabilityWindow[];
  ratingAvg: number | null;
  ratingCount: number;
  completedSessions: number;
  /** Sessions taught + sessions attended; a simple community participation signal. */
  communityContributions: number;
  status?: ProfileStatus;
}

export interface EligibilitySubmission {
  birthYear: number;
  birthMonth: number; // 1-12
  birthDay: number; // 1-31
  acceptedSafetyRules: boolean;
  guardianEmail?: string;
}

export interface ProfileUpdateInput {
  displayName: string;
  neighborhoodId: ID;
  bio: string;
  availabilitySummary: string;
  skills: UserSkill[];
}

export interface AvailabilityUpdateInput {
  windows: AvailabilityWindow[];
  customNote?: string;
}

export type PaymentMode = 'credits' | 'money' | 'mixed';

/**
 * How an instructor wants to be paid for one activity.
 * Invariants (enforced by a DB CHECK constraint):
 *  - credits → creditAmount > 0, moneyAmountCents undefined
 *  - money   → moneyAmountCents > 0, creditAmount undefined
 *  - mixed   → both > 0
 * There is deliberately NO global credit↔money exchange rate.
 */
export interface PaymentArrangement {
  mode: PaymentMode;
  creditAmount?: number;
  moneyAmountCents?: number;
  currency: 'ARS';
}

export type ActivityFormat = 'in_person' | 'online' | 'either';

export interface Activity {
  id: ID;
  instructorId: ID;
  skillId: ID;
  title: string;
  description: string;
  durationMin: number;
  format: ActivityFormat;
  /** Public meeting area (neighborhood / public place). Never a home address. */
  meetingArea: string;
  requirements: string;
  availabilitySummary: string;
  payment: PaymentArrangement;
  status: 'draft' | 'published' | 'paused' | 'archived';
}

export interface ActivityUpsertInput {
  id?: ID;
  skillId: ID;
  title: string;
  description: string;
  durationMin: number;
  format: ActivityFormat;
  meetingArea: string;
  requirements: string;
  availabilitySummary: string;
  payment: PaymentArrangement;
  status: 'published' | 'paused';
}

export type SessionState =
  | 'requested'
  | 'confirmed'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'in_progress'
  | 'no_show_pending'
  | 'completed'
  | 'disputed'
  | 'resolved';

export type CancellationTiming = 'timely' | 'late_review_window';

export interface Session {
  id: ID;
  activityId: ID;
  learnerId: ID;
  instructorId: ID;
  startsAt: UtcTimestamp;
  endsAt: UtcTimestamp;
  state: SessionState;
  /** Price snapshot copied at booking time; later edits to the activity don't change it. */
  price: PaymentArrangement;
  learnerNote?: string;
  cancellationReason?: string;
  cancellationTiming?: CancellationTiming;
  reviewWindowEndsAt?: UtcTimestamp;
  objectionReason?: string;
  objectionSubmittedAt?: UtcTimestamp;
}

export interface SessionRequestInput {
  activityId: ID;
  startsAt: UtcTimestamp;
  learnerNote?: string;
}

export interface SessionResponseInput {
  sessionId: ID;
  decision: 'confirm' | 'decline';
}

export interface SessionCancelInput {
  sessionId: ID;
  reason: string;
  /** Allows testing the <24h late-cancellation 48h review window on any upcoming session. */
  simulateLateWindow?: boolean;
}

export interface SubmitCancellationObjectionInput {
  sessionId: ID;
  reason: string;
}

export type MonetaryPaymentMethod = 'cash_or_transfer' | 'mercadopago';

export type MonetaryPaymentStatus =
  | 'pending'
  | 'reported_by_payer'
  | 'confirmed_by_payee'
  | 'disputed'
  | 'refunded';

/**
 * Separate accounting record for the ARS portion of 'money' or 'mixed' sessions.
 * Strictly separated from CreditLedgerEntry so credits and ARS never mix in one ledger.
 */
export interface MonetaryPayment {
  id: ID;
  sessionId: ID;
  activityTitle: string;
  payerId: ID;
  payeeId: ID;
  amountCents: number;
  currency: 'ARS';
  method: MonetaryPaymentMethod;
  status: MonetaryPaymentStatus;
  externalRef?: string;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

export interface ReportMonetaryPaymentInput {
  sessionId: ID;
  method: MonetaryPaymentMethod;
  externalRef?: string;
}

export interface ConfirmMonetaryPaymentInput {
  sessionId: ID;
}

export interface SafetyReportInput {
  targetUserId: ID;
  reason: string;
  blockUser: boolean;
}

export type CreditTxType = 'incentive' | 'hold' | 'release' | 'refund' | 'penalty' | 'adjustment';

/** One row of a user's view of the credit ledger (signed from the user's perspective). */
export interface CreditLedgerEntry {
  id: ID;
  type: CreditTxType;
  amount: number; // + received, − sent
  sessionId?: ID;
  idempotencyKey?: string;
  memo: string;
  createdAt: UtcTimestamp;
  status: 'posted' | 'pending';
}

export interface CreditWallet {
  available: number;
  heldInEscrow: number;
  /** Credits the user will receive once confirmed sessions they teach are verified. */
  incomingPending: number;
  earnedTotal: number;
  spentTotal: number;
  maxBalance: number | null;
  entries: CreditLedgerEntry[];
}

export interface LedgerInvariantCheck {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

export interface LedgerIntegrityReport {
  healthy: boolean;
  checkedAt: UtcTimestamp;
  available: number;
  heldInEscrow: number;
  incomingPending: number;
  maxBalance: number;
  circulationRatio: number;
  softCapReached: boolean;
  invariants: LedgerInvariantCheck[];
}

export interface Review {
  id: ID;
  sessionId: ID;
  authorId: ID;
  subjectId: ID;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: UtcTimestamp;
}

export type MatchKind = 'reciprocal' | 'wants_skill' | 'nearby';

export interface ActivityRecommendation {
  activity: Activity;
  instructor: Profile;
  score: number;
  reasons: MatchKind[];
  /** For reciprocal matches: the viewer's skill the instructor wants to learn. */
  reciprocalSkillId?: ID;
}

export interface ActivityFilters {
  query?: string;
  categoryId?: CategoryId;
  paymentMode?: PaymentMode;
  neighborhoodId?: ID;
  format?: ActivityFormat;
  onlyReciprocal?: boolean;
}
