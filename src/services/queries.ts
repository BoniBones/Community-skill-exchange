/**
 * React Query hooks: the only way screens read and mutate data.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ActivityFilters,
  ActivityUpsertInput,
  AvailabilityUpdateInput,
  EligibilitySubmission,
  ID,
  ProfileUpdateInput,
  SafetyReportInput,
  SessionCancelInput,
  SessionRequestInput,
  SessionResponseInput,
} from '../domain/types';
import { mockRepository } from './mockRepository';
import type { Repository } from './repository';

export const repository: Repository = mockRepository;
export const isDemoData = repository.kind === 'mock';

export const queryKeys = {
  me: ['me'] as const,
  profile: (id: ID) => ['profile', id] as const,
  activities: (f: ActivityFilters) => ['activities', f] as const,
  instructorActivities: (id: ID) => ['activities', 'instructor', id] as const,
  activity: (id: ID) => ['activity', id] as const,
  recommendations: (id: ID) => ['recommendations', id] as const,
  sessions: (id: ID) => ['sessions', id] as const,
  session: (id: ID) => ['session', id] as const,
  wallet: (id: ID) => ['wallet', id] as const,
  reviewsAbout: (id: ID) => ['reviews', id] as const,
  blockedUsers: (id: ID) => ['blocked-users', id] as const,
};

export function useCurrentUserId() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => repository.getCurrentUserId(), staleTime: Infinity });
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

export function useReviewsAbout(userId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.reviewsAbout(userId ?? ''),
    queryFn: () => repository.listReviewsAbout(userId!),
    enabled: !!userId,
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
        qc.invalidateQueries({ queryKey: queryKeys.recommendations(userId) });
        qc.invalidateQueries({ queryKey: ['activities'] });
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
      }
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
      }
    },
  });
}
