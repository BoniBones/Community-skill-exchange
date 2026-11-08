import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ActivityCard } from '../../components/activity';
import { SessionCard } from '../../components/session';
import { CATEGORIES, getNeighborhood, skillName } from '../../domain/catalog';
import { formatCredits } from '../../lib/format';
import {
  useActivities,
  useCurrentUserId,
  useProfile,
  useRecommendations,
  useSessions,
  useWallet,
} from '../../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../../ui/layout';
import { Avatar, Badge, Button, Card, IconCircle, Ionicons, Text, type IconName } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

export default function HomeScreen() {
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const wallet = useWallet(userId);
  const recs = useRecommendations(userId);
  const sessions = useSessions(userId);
  const allActivities = useActivities({});

  if (me.isLoading || recs.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando tu comunidad…" />
      </Screen>
    );
  }

  if (me.isError || !me.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => me.refetch()} />
      </Screen>
    );
  }

  const profile = me.data;
  const neighborhood = getNeighborhood(profile.neighborhoodId)?.name ?? 'Tu barrio';
  const upcoming = (sessions.data ?? []).filter(
    (s) => s.state === 'confirmed' || s.state === 'requested' || s.state === 'in_progress',
  );
  const nextSession = upcoming[0];
  const nextActivity = nextSession ? (allActivities.data ?? []).find((a) => a.id === nextSession.activityId) : undefined;

  const reciprocalMatches = (recs.data ?? []).filter((r) => r.reasons.includes('reciprocal'));
  const otherRecs = (recs.data ?? []).filter((r) => !r.reasons.includes('reciprocal')).slice(0, 4);

  return (
    <Screen
      refreshing={recs.isRefetching}
      onRefresh={() => {
        me.refetch();
        wallet.refetch();
        recs.refetch();
        sessions.refetch();
      }}
    >
      <DemoBanner />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color={colors.textMuted}>
            Comunidad · {neighborhood}
          </Text>
          <Text variant="title">Hola, {profile.displayName.split(' ')[0]}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver tus créditos disponibles"
          onPress={() => router.push('/(tabs)/wallet')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.creditSoft,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="time-outline" size={16} color={colors.credit} />
          <Text variant="bodyStrong" color={colors.credit}>
            {formatCredits(wallet.data?.available ?? 0)}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/profile')}>
          <Avatar name={profile.displayName} size={42} />
        </Pressable>
      </View>

      {/* Mission card */}
      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Badge label="FILOSOFÍA COMUNITARIA" fg={colors.primary} bg={colors.primarySoft} icon="heart-outline" />
        </View>
        <Text variant="bodyStrong">Todos tenemos algo para enseñar y algo para aprender.</Text>
        <Text variant="caption" color={colors.textMuted}>
          Enseñá una hora para sumar un crédito comunitario, o combiná créditos y dinero según lo que defina cada
          instructor.
        </Text>
      </Card>

      {/* Next session */}
      {nextSession ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader
            title="Tu próxima sesión"
            subtitle="Recordá verificar asistencia con código QR al empezar y terminar"
          />
          <SessionCard session={nextSession} activity={nextActivity} viewerId={profile.id} />
        </View>
      ) : null}

      {/* Reciprocal matches */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Coincidencias recíprocas"
          subtitle="Vecinos que enseñan lo que buscás y quieren aprender lo que vos ofrecés"
        />
        {reciprocalMatches.map((rec) => (
          <ActivityCard
            key={rec.activity.id}
            activity={rec.activity}
            instructor={rec.instructor}
            reasons={rec.reasons}
            footnote={
              rec.reciprocalSkillId
                ? `💡 ${rec.instructor.displayName.split(' ')[0]} quiere aprender ${skillName(rec.reciprocalSkillId)} (que vos enseñás)`
                : undefined
            }
          />
        ))}
      </View>

      {/* Categories */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Explorar por categoría" subtitle="Tocá una categoría para filtrar actividades" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/(tabs)/explore', params: { categoryId: c.id } })}
              style={({ pressed }) => ({
                width: '48%',
                flexGrow: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <IconCircle icon={c.icon as IconName} color={c.color} size={34} />
              <Text variant="caption" style={{ flex: 1, fontWeight: '600' }} numberOfLines={2}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Recommended for you */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Recomendadas para vos"
          subtitle="Según tus intereses, cercanía y participación en la comunidad"
          action={<Button title="Ver todas" variant="ghost" onPress={() => router.push('/(tabs)/explore')} />}
        />
        {otherRecs.map((rec) => (
          <ActivityCard
            key={rec.activity.id}
            activity={rec.activity}
            instructor={rec.instructor}
            reasons={rec.reasons}
          />
        ))}
      </View>
    </Screen>
  );
}
