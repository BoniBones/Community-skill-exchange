import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { ActivityCard, Rating, Stars } from '../../components/activity';
import { getNeighborhood, skillName } from '../../domain/catalog';
import { formatShortDate } from '../../lib/dates';
import { useI18n } from '../../lib/i18n';
import {
  useCurrentUserId,
  useInstructorActivities,
  useProfile,
  useProfiles,
  useReviewsAbout,
} from '../../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../../ui/layout';
import { Avatar, Badge, Button, Card, Chip, Ionicons, Text } from '../../ui/primitives';
import { radius, spacing, useTheme } from '../../ui/theme';

export default function ProfileScreen() {
  const { locale, t } = useI18n();
  const { colors } = useTheme();
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const allProfiles = useProfiles();
  const myActivities = useInstructorActivities(userId);
  const reviews = useReviewsAbout(userId);

  const profileMap = useMemo(
    () => new Map((allProfiles.data ?? []).map((pr) => [pr.id, pr])),
    [allProfiles.data],
  );

  if (me.isLoading) {
    return (
      <Screen>
        <LoadingState label={t('profileLoading')} />
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

  const p = me.data;
  const offers = p.skills.filter((s) => s.kind === 'offers');
  const wants = p.skills.filter((s) => s.kind === 'wants');

  return (
    <Screen
      refreshing={me.isRefetching}
      onRefresh={() => {
        me.refetch();
        myActivities.refetch();
        reviews.refetch();
        allProfiles.refetch();
      }}
    >
      <DemoBanner compact />

      {/* Identity card */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Avatar name={p.displayName} uri={p.avatarUrl} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title">{p.displayName}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {getNeighborhood(p.neighborhoodId)?.name ?? t('communityPrefix')} ·{' '}
              {t('profileMemberSince', { date: formatShortDate(p.memberSince, locale) })}
            </Text>
            <Rating avg={p.ratingAvg} count={p.ratingCount} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profileSettingsA11y')}
            onPress={() => router.push('/settings')}
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.pill,
              padding: 10,
            }}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
        <Text color={colors.text}>{p.bio}</Text>

        {/* Community stats */}
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
              {t('profileCompletedSessions')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading" color={colors.accent}>
              {p.communityContributions}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {t('profileContributions')}
            </Text>
          </View>
        </View>

        <Button
          title={t('profileSettingsBtn')}
          variant="secondary"
          icon="settings-outline"
          fullWidth
          onPress={() => router.push('/settings')}
        />
      </Card>

      {/* Skills offered & wanted */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.sm }}>
          <Badge label={t('profileCanTeachBadge')} fg={colors.primary} bg={colors.primarySoft} icon="easel-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {offers.map((s) => (
              <Chip key={s.skillId} label={skillName(s.skillId, locale)} selected tone={colors.primary} />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Badge label={t('profileWantLearnBadge')} fg={colors.accent} bg={colors.accentSoft} icon="bulb-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {wants.map((s) => (
              <Chip key={s.skillId} label={skillName(s.skillId, locale)} selected tone={colors.accent} />
            ))}
          </View>
        </View>
        <Text variant="caption" color={colors.textMuted}>
          {t('profileAvailabilityLabel', { summary: p.availabilitySummary })}
        </Text>
      </Card>

      {/* Published activities */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title={t('profileMyActivitiesTitle')}
          subtitle={t('profileMyActivitiesSubtitle')}
          action={
            <Button
              title={t('profileManageBtn')}
              variant="secondary"
              icon="create-outline"
              onPress={() => router.push('/my-activities')}
            />
          }
        />
        {(myActivities.data ?? []).map((a) => (
          <ActivityCard key={a.id} activity={a} instructor={p} />
        ))}
      </View>

      {/* Reviews */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('profileReviewsTitle')} subtitle={t('profileReviewsSubtitle')} />
        {(reviews.data ?? []).map((r) => {
          const author = profileMap.get(r.authorId);
          return (
            <Card key={r.id} variant="flat" style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="bodyStrong">{author?.displayName ?? t('commonMember')}</Text>
                <Stars value={r.rating} />
              </View>
              <Text color={colors.text}>{r.comment}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {formatShortDate(r.createdAt, locale)}
              </Text>
            </Card>
          );
        })}
      </View>

      {/* Community & Moderation shortcuts */}
      <Card variant="tinted" style={{ gap: spacing.sm }}>
        <Text variant="bodyStrong">{t('profileCommunityShortcutsTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('profileCommunityShortcutsSubtitle')}
        </Text>
        <Button
          title={t('profileNotificationsBtn')}
          variant="secondary"
          icon="notifications-outline"
          fullWidth
          onPress={() => router.push('/notifications')}
        />
        <Button
          title={t('profileModerationBtn')}
          variant="secondary"
          icon="shield-checkmark-outline"
          fullWidth
          onPress={() => router.push('/admin')}
        />
      </Card>
    </Screen>
  );
}
