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
  | 'languages'
  | 'music'
  | 'academic'
  | 'tech'
  | 'sports'
  | 'arts_crafts'
  | 'practical';

export interface SkillCategory {
  id: CategoryId;
  name: string;
  nameEn?: string;
  icon: string; // Ionicons glyph name
  color: string;
  darkColor: string;
}

export interface Skill {
  id: ID;
  categoryId: CategoryId;
  name: string;
  nameEn?: string;
  description?: string;
  isCustom?: boolean;
  createdBy?: ID;
}

export interface CustomSkillInput {
  name: string;
  categoryId: CategoryId;
  description?: string;
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
  isActive: boolean;
}

export interface NeighborhoodAccessInput {
  neighborhoodId: ID;
  accessCode: string;
}

export interface ProfilePhotoAssetInput {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  fileName?: string | null;
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
  neighborhoodVerifiedAt?: UtcTimestamp | null;
  bio: string;
  memberSince: UtcTimestamp;
  skills: UserSkill[];
  availabilitySummary: string;
  availabilityWindows?: AvailabilityWindow[];
  availabilityNote?: string;
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
  neighborhoodVerifiedAt?: UtcTimestamp | null;
  avatarUrl?: string | null;
  bio: string;
  availabilitySummary: string;
  skills: UserSkill[];
}

export interface AvailabilityUpdateInput {
  windows: AvailabilityWindow[];
  customNote?: string;
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
  /** Integer time-credits per session (1h teaching = 1 credit, non-cashable, >= 1). */
  creditAmount: number;
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
  creditAmount: number;
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

export type VerificationPhase = 'check_in' | 'check_out';

export interface Session {
  id: ID;
  activityId: ID;
  learnerId: ID;
  instructorId: ID;
  startsAt: UtcTimestamp;
  endsAt: UtcTimestamp;
  state: SessionState;
  /** Integer credit snapshot copied at booking time; later edits to the activity don't change it. */
  creditAmount: number;
  learnerNote?: string;
  cancellationReason?: string;
  cancellationTiming?: CancellationTiming;
  reviewWindowEndsAt?: UtcTimestamp;
  objectionReason?: string;
  objectionSubmittedAt?: UtcTimestamp;
  checkedInAt?: UtcTimestamp;
  checkedOutAt?: UtcTimestamp;
}

export interface SessionVerificationToken {
  id: ID;
  sessionId: ID;
  phase: VerificationPhase;
  issuerId: ID;
  /** Short 6-character manual fallback / QR nonce */
  code: string;
  /** SHA-256 hex digest stored on the server */
  tokenHash: string;
  /** Deep-link QR payload */
  qrPayload: string;
  expiresAt: UtcTimestamp;
  usedAt?: UtcTimestamp;
  usedBy?: ID;
}

export interface IssueSessionTokenInput {
  sessionId: ID;
  phase: VerificationPhase;
}

export interface RedeemSessionTokenInput {
  sessionId: ID;
  phase: VerificationPhase;
  code: string;
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

export interface ReviewCreateInput {
  sessionId: ID;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
}

export type NotificationType =
  | 'session_requested'
  | 'session_confirmed'
  | 'session_completed'
  | 'credit_released'
  | 'review_received'
  | 'dispute_opened'
  | 'dispute_resolved';

export interface AppNotification {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  sessionId?: ID;
  actorId?: ID;
  readAt?: UtcTimestamp;
  createdAt: UtcTimestamp;
}

export type DisputeStatus = 'open' | 'resolved_refund' | 'resolved_release';

export interface DisputeRecord {
  id: ID;
  sessionId: ID;
  activityTitle: string;
  openedBy: ID;
  learnerId: ID;
  instructorId: ID;
  creditAmount: number;
  reason: string;
  status: DisputeStatus;
  resolutionNote?: string;
  resolvedBy?: ID;
  createdAt: UtcTimestamp;
  resolvedAt?: UtcTimestamp;
}

export interface ResolveDisputeInput {
  disputeId: ID;
  resolution: 'resolved_refund' | 'resolved_release';
  resolutionNote: string;
}

export interface SafetyReportRecord {
  id: ID;
  reporterId: ID;
  targetUserId: ID;
  reason: string;
  status: 'open' | 'reviewed' | 'dismissed';
  createdAt: UtcTimestamp;
}

export interface ResolveReportInput {
  reportId: ID;
  status: 'reviewed' | 'dismissed';
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
  neighborhoodId?: ID;
  format?: ActivityFormat;
  onlyReciprocal?: boolean;
}
