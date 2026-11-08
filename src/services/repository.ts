/**
 * Repository contract. Screens never talk to a data source directly; they use the
 * React Query hooks in ./queries.ts, which call this interface.
 */
import type {
  Activity,
  ActivityFilters,
  ActivityRecommendation,
  ActivityUpsertInput,
  AvailabilityUpdateInput,
  CreditWallet,
  EligibilitySubmission,
  ID,
  Profile,
  ProfileStatus,
  ProfileUpdateInput,
  Review,
  SafetyReportInput,
  Session,
  SessionCancelInput,
  SessionRequestInput,
  SessionResponseInput,
} from '../domain/types';

export interface Repository {
  readonly kind: 'mock' | 'supabase';
  getCurrentUserId(): Promise<ID>;
  getProfile(id: ID): Promise<Profile | null>;
  updateProfile(userId: ID, input: ProfileUpdateInput): Promise<Profile>;
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
  getWallet(userId: ID): Promise<CreditWallet>;
  listReviewsAbout(userId: ID): Promise<Review[]>;
  reportOrBlockUser(userId: ID, input: SafetyReportInput): Promise<void>;
  listBlockedUserIds(userId: ID): Promise<ID[]>;
}
