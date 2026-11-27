/**
 * React Query hooks: the only way screens read and mutate data.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ActivityFilters,
  ActivityUpsertInput,
  AvailabilityUpdateInput,
  CustomSkillInput,
  EligibilitySubmission,
  ID,
  IssueSessionTokenInput,
  NeighborhoodAccessInput,
  ProfilePhotoAssetInput,
  ProfileUpdateInput,
  RedeemSessionTokenInput,
  ResolveDisputeInput,
  ResolveReportInput,
  ReviewCreateInput,
  SafetyReportInput,
  SessionCancelInput,
  SessionRequestInput,
  SessionResponseInput,
  SubmitCancellationObjectionInput,
} from '../domain/types';
import { mockRepository, summarizeAvailability } from './mockRepository';
import type { Repository } from './repository';

export { summarizeAvailability };
export const repository: Repository = mockRepository;
export const isDemoData = repository.kind === 'mock';

export const queryKeys = {
  me: ['me'] as const,
  skills: ['skills'] as const,
  neighborhoods: ['neighborhoods'] as const,
  profiles: ['profiles'] as const,
  profile: (id: ID) => ['profile', id] as const,
  activities: (f: ActivityFilters) => ['activities', f] as const,
  instructorActivities: (id: ID) => ['activities', 'instructor', id] as const,
  activity: (id: ID) => ['activity', id] as const,
  recommendations: (id: ID) => ['recommendations', id] as const,
  sessions: (id: ID) => ['sessions', id] as const,
  session: (id: ID) => ['session', id] as const,
  wallet: (id: ID) => ['wallet', id] as const,
  ledgerIntegrity: (id: ID) => ['ledger-integrity', id] as const,
  reviewsAbout: (id: ID) => ['reviews', id] as const,
  sessionReviews: (sessionId: ID) => ['session-reviews', sessionId] as const,
  notifications: (id: ID) => ['notifications', id] as const,
  disputes: ['disputes'] as const,
  safetyReports: ['safety-reports'] as const,
  blockedUsers: (id: ID) => ['blocked-users', id] as const,
};

export function useCurrentUserId() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => repository.getCurrentUserId(), staleTime: Infinity });
}

export function useSkills() {
  return useQuery({ queryKey: queryKeys.skills, queryFn: () => repository.listSkills() });
}

export function useNeighborhoods() {
  return useQuery({ queryKey: queryKeys.neighborhoods, queryFn: () => repository.listNeighborhoods() });
}

export function useProfiles() {
  return useQuery({ queryKey: queryKeys.profiles, queryFn: () => repository.listProfiles() });
}

export function useProfile(id: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(id ?? ''),
    queryFn: () => repository.getProfile(id!),
    enabled: !!id,
  });
}

export function useActivities(filters: ActivityFilters) {
  return useQuery({ queryKey: queryKeys.activities(filters), queryFn: () => repository.listActivities(filters) });
}

export function useInstructorActivities(id: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.instructorActivities(id ?? ''),
    queryFn: () => repository.listActivitiesByInstructor(id!),
    enabled: !!id,
  });
}

export function useActivity(id: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.activity(id ?? ''),
    queryFn: () => repository.getActivity(id!),
    enabled: !!id,
  });
}

export function useRecommendations(userId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.recommendations(userId ?? ''),
    queryFn: () => repository.getRecommendations(userId!),
    enabled: !!userId,
  });
}

export function useSessions(userId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.sessions(userId ?? ''),
    queryFn: () => repository.listSessions(userId!),
    enabled: !!userId,
  });
}

export function useSession(id: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.session(id ?? ''),
    queryFn: () => repository.getSession(id!),
    enabled: !!id,
  });
}

export function useWallet(userId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.wallet(userId ?? ''),
    queryFn: () => repository.getWallet(userId!),
    enabled: !!userId,
  });
}

export function useLedgerIntegrity(userId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.ledgerIntegrity(userId ?? ''),
    queryFn: () => repository.getLedgerIntegrity(userId!),
    enabled: !!userId,
  });
}

export function useReviewsAbout(userId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.reviewsAbout(userId ?? ''),
    queryFn: () => repository.listReviewsAbout(userId!),
    enabled: !!userId,
  });
}

export function useSessionReviews(sessionId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.sessionReviews(sessionId ?? ''),
    queryFn: () => repository.listReviewsBySession(sessionId!),
    enabled: !!sessionId,
  });
}

export function useNotifications(userId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications(userId ?? ''),
    queryFn: () => repository.listNotifications(userId!),
    enabled: !!userId,
  });
}

export function useDisputes() {
  return useQuery({
    queryKey: queryKeys.disputes,
    queryFn: () => repository.listDisputes(),
  });
}

export function useSafetyReports() {
  return useQuery({
    queryKey: queryKeys.safetyReports,
    queryFn: () => repository.listSafetyReports(),
  });
}

export function useBlockedUsers(userId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.blockedUsers(userId ?? ''),
    queryFn: () => repository.listBlockedUserIds(userId!),
    enabled: !!userId,
  });
}

/* ───────────────────────── Mutations ───────────────────────── */

export function useSubmitEligibility(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EligibilitySubmission) => repository.submitEligibility(userId!, input),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });
}

export function useUpdateProfile(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileUpdateInput) => repository.updateProfile(userId!, input),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.profiles });
        qc.invalidateQueries({ queryKey: queryKeys.recommendations(userId) });
        qc.invalidateQueries({ queryKey: ['activities'] });
      }
    },
  });
}

export function useCreateCustomSkill(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomSkillInput) => repository.createCustomSkill(userId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.skills });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useUploadProfilePhoto(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (asset: ProfilePhotoAssetInput) => repository.uploadProfilePhoto(userId!, asset),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.profiles });
        qc.invalidateQueries({ queryKey: queryKeys.recommendations(userId) });
        qc.invalidateQueries({ queryKey: ['activities'] });
      }
    },
  });
}

export function useRemoveProfilePhoto(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => repository.removeProfilePhoto(userId!),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.profiles });
        qc.invalidateQueries({ queryKey: queryKeys.recommendations(userId) });
        qc.invalidateQueries({ queryKey: ['activities'] });
      }
    },
  });
}

export function useVerifyNeighborhoodAccess(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NeighborhoodAccessInput) => repository.verifyNeighborhoodAccess(userId!, input),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.profiles });
        qc.invalidateQueries({ queryKey: queryKeys.recommendations(userId) });
      }
    },
  });
}

export function useUpdateAvailability(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AvailabilityUpdateInput) => repository.updateAvailability(userId!, input),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.profiles });
      }
    },
  });
}

export function useUpsertActivity(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActivityUpsertInput) => repository.upsertActivity(userId!, input),
    onSuccess: ({ activity }) => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.instructorActivities(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.activity(activity.id) });
        qc.invalidateQueries({ queryKey: ['activities'] });
        qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.wallet(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.ledgerIntegrity(userId) });
      }
    },
  });
}

export function useRequestSession(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SessionRequestInput) => repository.requestSession(userId!, input),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.sessions(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.wallet(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.ledgerIntegrity(userId) });
      }
    },
  });
}

export function useRespondToSession(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SessionResponseInput) => repository.respondToSession(userId!, input),
    onSuccess: (session) => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.session(session.id) });
        qc.invalidateQueries({ queryKey: queryKeys.sessions(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.wallet(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.ledgerIntegrity(userId) });
      }
    },
  });
}

export function useCancelSession(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SessionCancelInput) => repository.cancelSession(userId!, input),
    onSuccess: ({ session }) => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.session(session.id) });
        qc.invalidateQueries({ queryKey: queryKeys.sessions(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.wallet(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.ledgerIntegrity(userId) });
      }
    },
  });
}

export function useSubmitCancellationObjection(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitCancellationObjectionInput) =>
      repository.submitCancellationObjection(userId!, input),
    onSuccess: (session) => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.session(session.id) });
        qc.invalidateQueries({ queryKey: queryKeys.sessions(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.wallet(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.ledgerIntegrity(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.disputes });
        qc.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      }
    },
  });
}

export function useIssueSessionToken(userId: ID | undefined) {
  return useMutation({
    mutationFn: (input: IssueSessionTokenInput) => repository.issueSessionToken(userId!, input),
  });
}

export function useRedeemSessionToken(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RedeemSessionTokenInput & { demoScannerId?: ID }) =>
      repository.redeemSessionToken(
        isDemoData && input.demoScannerId ? input.demoScannerId : userId!,
        { sessionId: input.sessionId, phase: input.phase, code: input.code },
      ),
    onSuccess: ({ session }) => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.session(session.id) });
        qc.invalidateQueries({ queryKey: queryKeys.sessions(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.wallet(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.ledgerIntegrity(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.profile(session.learnerId) });
        qc.invalidateQueries({ queryKey: queryKeys.profile(session.instructorId) });
        qc.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      }
    },
  });
}

export function useSubmitReview(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewCreateInput) => repository.submitReview(userId!, input),
    onSuccess: (review) => {
      qc.invalidateQueries({ queryKey: queryKeys.sessionReviews(review.sessionId) });
      qc.invalidateQueries({ queryKey: queryKeys.reviewsAbout(review.subjectId) });
      qc.invalidateQueries({ queryKey: queryKeys.profile(review.subjectId) });
    },
  });
}

export function useMarkAllNotificationsRead(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => repository.markAllNotificationsRead(userId!),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
    },
  });
}

export function useResolveDispute(moderatorId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveDisputeInput) => repository.resolveDispute(moderatorId!, input),
    onSuccess: (dispute) => {
      qc.invalidateQueries({ queryKey: queryKeys.disputes });
      qc.invalidateQueries({ queryKey: queryKeys.session(dispute.sessionId) });
      if (moderatorId) {
        qc.invalidateQueries({ queryKey: queryKeys.sessions(moderatorId) });
        qc.invalidateQueries({ queryKey: queryKeys.wallet(moderatorId) });
        qc.invalidateQueries({ queryKey: queryKeys.ledgerIntegrity(moderatorId) });
        qc.invalidateQueries({ queryKey: queryKeys.notifications(moderatorId) });
      }
    },
  });
}

export function useResolveSafetyReport(moderatorId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveReportInput) => repository.resolveSafetyReport(moderatorId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.safetyReports });
    },
  });
}

export function useReportOrBlockUser(userId: ID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SafetyReportInput) => repository.reportOrBlockUser(userId!, input),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.blockedUsers(userId) });
        qc.invalidateQueries({ queryKey: queryKeys.recommendations(userId) });
        qc.invalidateQueries({ queryKey: ['activities'] });
        qc.invalidateQueries({ queryKey: queryKeys.safetyReports });
      }
    },
  });
}
