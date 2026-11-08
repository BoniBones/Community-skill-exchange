import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ActivityCard, Rating, Stars } from '../../components/activity';
import { getNeighborhood, skillName } from '../../domain/catalog';
import { formatShortDate } from '../../lib/dates';
import { profiles } from '../../mocks/data';
import {
  useCurrentUserId,
  useInstructorActivities,
  useProfile,
  useReviewsAbout,
} from '../../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../../ui/layout';
import { Avatar, Badge, Card, Chip, Text } from '../../ui/primitives';
import { colors, spacing } from '../../ui/theme';

const profileMap = new Map(profiles.map((p) => [p.id, p]));

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: viewerId } = useCurrentUserId();
  const user = useProfile(id);
  const viewer = useProfile(viewerId);
  const activities = useInstructorActivities(id);
  const reviews = useReviewsAbout(id);

  if (user.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Cargando perfil…" />
      </Screen>
    );
  }

  if (!user.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="No encontramos este perfil." onRetry={() => user.refetch()} />
      </Screen>
    );
  }

  const p = user.data;
  const offers = p.skills.filter((s) => s.kind === 'offers');
  const wants = p.skills.filter((s) => s.kind === 'wants');
  const viewerOffers = new Set((viewer.data?.skills ?? []).filter((s) => s.kind === 'offers').map((s) => s.skillId));

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Avatar name={p.displayName} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title">{p.displayName}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {getNeighborhood(p.neighborhoodId)?.name ?? 'Comunidad'} · Miembro desde {formatShortDate(p.memberSince)}
            </Text>
            <Rating avg={p.ratingAvg} count={p.ratingCount} />
          </View>
        </View>
        <Text color={colors.text}>{p.bio}</Text>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="heading" color={colors.primary}>
              {p.completedSessions}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              Sesiones completadas
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading" color={colors.accent}>
              {p.communityContributions}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              Aportes a la comunidad
            </Text>
          </View>
        </View>
      </Card>

      {/* Skills */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.sm }}>
          <Badge label="ENSEÑA" fg={colors.primary} bg={colors.primarySoft} icon="easel-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {offers.map((s) => (
              <Chip key={s.skillId} label={skillName(s.skillId)} selected tone={colors.primary} />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Badge label="QUIERE APRENDER" fg={colors.accent} bg={colors.accentSoft} icon="bulb-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {wants.map((s) => {
              const youTeach = viewerOffers.has(s.skillId);
              return (
                <Chip
                  key={s.skillId}
                  label={youTeach ? `${skillName(s.skillId)} (vos enseñás)` : skillName(s.skillId)}
                  selected
                  tone={youTeach ? colors.accent : colors.textMuted}
                />
              );
            })}
          </View>
        </View>
        <Text variant="caption" color={colors.textMuted}>
          Disponibilidad habitual: {p.availabilitySummary}
        </Text>
      </Card>

      {/* Activities */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={`Actividades de ${p.displayName.split(' ')[0]}`} />
        {(activities.data ?? []).map((a) => (
          <ActivityCard key={a.id} activity={a} instructor={p} />
        ))}
      </View>

      {/* Reviews */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Reseñas de la comunidad" />
        {(reviews.data ?? []).length === 0 ? (
          <Text variant="caption" color={colors.textMuted}>
            Todavía no tiene reseñas verificadas.
          </Text>
        ) : (
          (reviews.data ?? []).map((r) => (
            <Card key={r.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="bodyStrong">{profileMap.get(r.authorId)?.displayName ?? 'Miembro'}</Text>
                <Stars value={r.rating} />
              </View>
              <Text color={colors.text}>{r.comment}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {formatShortDate(r.createdAt)}
              </Text>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
