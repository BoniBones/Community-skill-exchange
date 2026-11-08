/**
 * React Query hooks: the only way screens read data.
 * The repository is picked once from config.dataMode. Until the Supabase
 * repository lands in Stage 3, 'supabase' mode still falls back to mock data,
 * and the UI keeps showing the DEMO badge so nothing simulated looks real.
 */
import { useQuery } from '@tanstack/react-query';

import type { ActivityFilters, ID } from '../domain/types';
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
