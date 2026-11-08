import { useState } from 'react';
import { View } from 'react-native';

import { SessionCard } from '../../components/session';
import { activities, profiles } from '../../mocks/data';
import { useCurrentUserId, useSessions } from '../../services/queries';
import { DemoBanner, EmptyState, LoadingState, Screen } from '../../ui/layout';
import { Chip, Text } from '../../ui/primitives';
import { colors, spacing } from '../../ui/theme';

const activityMap = new Map(activities.map((a) => [a.id, a]));
const profileMap = new Map(profiles.map((p) => [p.id, p]));

type TabFilter = 'upcoming' | 'past';
type RoleFilter = 'all' | 'learning' | 'teaching';

export default function SessionsScreen() {
  const { data: userId } = useCurrentUserId();
  const sessions = useSessions(userId);
  const [tab, setTab] = useState<TabFilter>('upcoming');
  const [role, setRole] = useState<RoleFilter>('all');

  if (sessions.isLoading || !userId) {
    return (
      <Screen>
        <LoadingState label="Cargando tus sesiones…" />
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
    <Screen refreshing={sessions.isRefetching} onRefresh={() => sessions.refetch()}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">Mis sesiones</Text>
        <Text variant="caption" color={colors.textMuted}>
          Horarios expresados en hora de Argentina (America/Argentina/Buenos_Aires).
        </Text>
      </View>

      {/* Upcoming / Past toggle */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="Próximas" selected={tab === 'upcoming'} onPress={() => setTab('upcoming')} />
        <Chip label="Historial" selected={tab === 'past'} onPress={() => setTab('past')} />
      </View>

      {/* Role filter */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Chip label="Todas" selected={role === 'all'} onPress={() => setRole('all')} />
        <Chip
          label="Aprendiendo"
          icon="book-outline"
          selected={role === 'learning'}
          onPress={() => setRole('learning')}
        />
        <Chip
          label="Enseñando"
          icon="easel-outline"
          selected={role === 'teaching'}
          tone={colors.accent}
          onPress={() => setRole('teaching')}
        />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={tab === 'upcoming' ? 'No tenés sesiones próximas' : 'Sin sesiones en el historial'}
          message="Explorá actividades de la comunidad para coordinar tu próximo encuentro."
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
