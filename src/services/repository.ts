/**
 * Repository contract. Screens never talk to a data source directly; they use the
 * React Query hooks in ./queries.ts, which call this interface.
 */
import type {
  Activity,
  ActivityFilters,
  ActivityRecommendation,
  ActivityUpsertInput,
  AppNotification,
  AvailabilityUpdateInput,
  CreditWallet,
  CustomSkillInput,
  DisputeRecord,
  EligibilitySubmission,
  ID,
  IssueSessionTokenInput,
  LedgerIntegrityReport,
  Neighborhood,
  NeighborhoodAccessInput,
  Profile,
  ProfilePhotoAssetInput,
  ProfileStatus,
  ProfileUpdateInput,
  RedeemSessionTokenInput,
  ResolveDisputeInput,
  ResolveReportInput,
  Review,
  ReviewCreateInput,
  SafetyReportInput,
  SafetyReportRecord,
  Session,
  SessionCancelInput,
  SessionRequestInput,
  SessionResponseInput,
  SessionVerificationToken,
  Skill,
  SubmitCancellationObjectionInput,
} from '../domain/types';

export interface Repository {
  readonly kind: 'mock' | 'supabase';
  getCurrentUserId(): Promise<ID>;
  listSkills(): Promise<Skill[]>;
  createCustomSkill(userId: ID, input: CustomSkillInput): Promise<Skill>;
  listNeighborhoods(): Promise<Neighborhood[]>;
  verifyNeighborhoodAccess(userId: ID, input: NeighborhoodAccessInput): Promise<Profile>;
  listProfiles(): Promise<Profile[]>;
  getProfile(id: ID): Promise<Profile | null>;
  updateProfile(userId: ID, input: ProfileUpdateInput): Promise<Profile>;
  uploadProfilePhoto(userId: ID, asset: ProfilePhotoAssetInput): Promise<string>;
  removeProfilePhoto(userId: ID): Promise<void>;
  updateAvailability(userId: ID, input: AvailabilityUpdateInput): Promise<Profile>;
  submitEligibility(
    userId: ID,
    input: EligibilitySubmission,
  ): Promise<{ status: ProfileStatus; age: number; eligible: boolean; message: string }>;
  listActivities(filters?: ActivityFilters): Promise<Activity[]>;
  listActivitiesByInstructor(instructorId: ID): Promise<Activity[]>;
  getActivity(id: ID): Promise<Activity | null>;
  upsertActivity(instructorId: ID, input: ActivityUpsertInput): Promise<{ activity: Activity; grantedIncentive: boolean }>;
  getRecommendations(userId: ID): Promise<ActivityRecommendation[]>;
  listSessions(userId: ID): Promise<Session[]>;
  getSession(id: ID): Promise<Session | null>;
  requestSession(userId: ID, input: SessionRequestInput): Promise<Session>;
  respondToSession(userId: ID, input: SessionResponseInput): Promise<Session>;
  cancelSession(userId: ID, input: SessionCancelInput): Promise<{ session: Session; refundMessage: string }>;
  submitCancellationObjection(userId: ID, input: SubmitCancellationObjectionInput): Promise<Session>;
  issueSessionToken(userId: ID, input: IssueSessionTokenInput): Promise<SessionVerificationToken>;
  redeemSessionToken(
    userId: ID,
    input: RedeemSessionTokenInput,
  ): Promise<{ session: Session; releasedCredits: number; message: string }>;
  getWallet(userId: ID): Promise<CreditWallet>;
  getLedgerIntegrity(userId: ID): Promise<LedgerIntegrityReport>;
  listReviewsAbout(userId: ID): Promise<Review[]>;
  listReviewsBySession(sessionId: ID): Promise<Review[]>;
  submitReview(userId: ID, input: ReviewCreateInput): Promise<Review>;
  listNotifications(userId: ID): Promise<AppNotification[]>;
  markAllNotificationsRead(userId: ID): Promise<void>;
  listDisputes(): Promise<DisputeRecord[]>;
  resolveDispute(moderatorId: ID, input: ResolveDisputeInput): Promise<DisputeRecord>;
  listSafetyReports(): Promise<SafetyReportRecord[]>;
  resolveSafetyReport(moderatorId: ID, input: ResolveReportInput): Promise<SafetyReportRecord>;
  reportOrBlockUser(userId: ID, input: SafetyReportInput): Promise<void>;
  listBlockedUserIds(userId: ID): Promise<ID[]>;
}
