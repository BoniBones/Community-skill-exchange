import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SessionCard } from '../../components/session';
import { useI18n } from '../../lib/i18n';
import { useActivities, useCurrentUserId, useProfiles, useSessions } from '../../services/queries';
import { DemoBanner, EmptyState, LoadingState, Screen } from '../../ui/layout';
import { Chip, Text } from '../../ui/primitives';
import { spacing, useTheme } from '../../ui/theme';

type TabFilter = 'upcoming' | 'past';
type RoleFilter = 'all' | 'learning' | 'teaching';

export default function SessionsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { data: userId } = useCurrentUserId();
  const sessions = useSessions(userId);
  const allActivities = useActivities({});
  const allProfiles = useProfiles();

  const [tab, setTab] = useState<TabFilter>('upcoming');
  const [role, setRole] = useState<RoleFilter>('all');

  const activityMap = useMemo(
    () => new Map((allActivities.data ?? []).map((a) => [a.id, a])),
    [allActivities.data],
  );
  const profileMap = useMemo(
    () => new Map((allProfiles.data ?? []).map((p) => [p.id, p])),
    [allProfiles.data],
  );

  if (sessions.isLoading || !userId) {
    return (
      <Screen>
        <LoadingState label={t('sessionsLoading')} />
      </Screen>
    );
  }

  const all = sessions.data ?? [];
  const isUpcomingState = (s: string) => s === 'requested' || s === 'confirmed' || s === 'in_progress';

  const filtered = all.filter((s) => {
    const matchesTab = tab === 'upcoming' ? isUpcomingState(s.state) : !isUpcomingState(s.state);
    if (!matchesTab) return false;
    if (role === 'learning') return s.learnerId === userId;
    if (role === 'teaching') return s.instructorId === userId;
    return true;
  });

  return (
    <Screen
      refreshing={sessions.isRefetching}
      onRefresh={() => {
        sessions.refetch();
        allActivities.refetch();
        allProfiles.refetch();
      }}
    >
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">{t('sessionsTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('sessionsTimezoneNote')}
        </Text>
      </View>

      {/* Upcoming / Past toggle */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label={t('sessionsUpcoming')} selected={tab === 'upcoming'} onPress={() => setTab('upcoming')} />
        <Chip label={t('sessionsPast')} selected={tab === 'past'} onPress={() => setTab('past')} />
      </View>

      {/* Role filter */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Chip label={t('sessionsRoleAll')} selected={role === 'all'} onPress={() => setRole('all')} />
        <Chip
          label={t('sessionsRoleLearning')}
          icon="book-outline"
          selected={role === 'learning'}
          onPress={() => setRole('learning')}
        />
        <Chip
          label={t('sessionsRoleTeaching')}
          icon="easel-outline"
          selected={role === 'teaching'}
          tone={colors.accent}
          onPress={() => setRole('teaching')}
        />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={tab === 'upcoming' ? t('sessionsEmptyUpcoming') : t('sessionsEmptyPast')}
          message={t('sessionsEmptyMessage')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {filtered.map((s) => {
            const counterpartId = s.instructorId === userId ? s.learnerId : s.instructorId;
            return (
              <SessionCard
                key={s.id}
                session={s}
                activity={activityMap.get(s.activityId)}
                counterpart={profileMap.get(counterpartId)}
                viewerId={userId}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}
