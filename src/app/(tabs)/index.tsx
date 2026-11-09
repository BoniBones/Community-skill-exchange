import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ActivityCard } from '../../components/activity';
import { SessionCard } from '../../components/session';
import { CATEGORIES, getNeighborhood, skillName } from '../../domain/catalog';
import { formatCredits } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import {
  useActivities,
  useCurrentUserId,
  useNotifications,
  useProfile,
  useRecommendations,
  useSessions,
  useWallet,
} from '../../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../../ui/layout';
import { Avatar, Badge, Button, Card, IconCircle, Ionicons, Text, type IconName } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

export default function HomeScreen() {
  const { t } = useI18n();
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const wallet = useWallet(userId);
  const recs = useRecommendations(userId);
  const sessions = useSessions(userId);
  const notifications = useNotifications(userId);
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
  const unreadNotifications = (notifications.data ?? []).filter((n) => !n.readAt).length;
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
        notifications.refetch();
      }}
    >
      <DemoBanner />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color={colors.textMuted}>
            {t('communityPrefix')} · {neighborhood}
          </Text>
          <Text variant="title">
            {t('homeGreeting')}, {profile.displayName.split(' ')[0]}
          </Text>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver notificaciones de la comunidad"
          onPress={() => router.push('/notifications')}
          style={{
            position: 'relative',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.pill,
            padding: 9,
          }}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {unreadNotifications > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                backgroundColor: colors.accent,
                borderRadius: radius.pill,
                minWidth: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text variant="caption" color="#FFFFFF" style={{ fontSize: 10, fontWeight: '700' }}>
                {unreadNotifications}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/profile')}>
          <Avatar name={profile.displayName} size={42} />
        </Pressable>
      </View>

      {/* Mission card */}
      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Badge label={t('missionBadge')} fg={colors.primary} bg={colors.primarySoft} icon="heart-outline" />
        </View>
        <Text variant="bodyStrong">{t('communityTagline')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('communityMission')}
        </Text>
      </Card>

      {/* Next session */}
      {nextSession ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t('nextSessionTitle')} subtitle={t('nextSessionSubtitle')} />
          <SessionCard session={nextSession} activity={nextActivity} viewerId={profile.id} />
        </View>
      ) : null}

      {/* Reciprocal matches */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('reciprocalTitle')} subtitle={t('reciprocalSubtitle')} />
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
        <SectionHeader title={t('categoriesTitle')} subtitle={t('categoriesSubtitle')} />
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
          title={t('recommendedTitle')}
          subtitle={t('recommendedSubtitle')}
          action={<Button title={t('seeAll')} variant="ghost" onPress={() => router.push('/(tabs)/explore')} />}
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
