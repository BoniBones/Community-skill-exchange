import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ActivityCard, Rating, Stars } from '../../components/activity';
import { getNeighborhood, skillName } from '../../domain/catalog';
import { formatShortDate } from '../../lib/dates';
import { useI18n } from '../../lib/i18n';
import {
  useBlockedUsers,
  useCurrentUserId,
  useInstructorActivities,
  useProfile,
  useProfiles,
  useReportOrBlockUser,
  useReviewsAbout,
} from '../../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../../ui/layout';
import { Avatar, Badge, Button, Card, Chip, Text } from '../../ui/primitives';
import { animateLayout, spacing, useTheme } from '../../ui/theme';

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const { data: viewerId } = useCurrentUserId();
  const user = useProfile(id);
  const viewer = useProfile(viewerId);
  const allProfiles = useProfiles();
  const activities = useInstructorActivities(id);
  const reviews = useReviewsAbout(id);
  const blockedUsers = useBlockedUsers(viewerId);
  const reportOrBlock = useReportOrBlockUser(viewerId);

  const reportReasons = [t('reportReason1'), t('reportReason2'), t('reportReason3')];
  const [showSafetyPanel, setShowSafetyPanel] = useState(false);
  const [selectedReasonIdx, setSelectedReasonIdx] = useState(0);
  const [safetySubmitted, setSafetySubmitted] = useState<string | null>(null);
  const [safetyError, setSafetyError] = useState<string | null>(null);

  const profileMap = useMemo(
    () => new Map((allProfiles.data ?? []).map((pr) => [pr.id, pr])),
    [allProfiles.data],
  );

  if (user.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label={t('userProfLoading')} />
      </Screen>
    );
  }

  if (!user.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message={t('userProfNotFound')} onRetry={() => user.refetch()} />
      </Screen>
    );
  }

  const p = user.data;
  const offers = p.skills.filter((s) => s.kind === 'offers');
  const wants = p.skills.filter((s) => s.kind === 'wants');
  const viewerOffers = new Set((viewer.data?.skills ?? []).filter((s) => s.kind === 'offers').map((s) => s.skillId));
  const isBlocked = (blockedUsers.data ?? []).includes(p.id);
  const selectedReason = reportReasons[selectedReasonIdx] ?? reportReasons[0]!;

  const handleSafetySubmit = async (blockUser: boolean) => {
    setSafetyError(null);
    try {
      await reportOrBlock.mutateAsync({
        targetUserId: p.id,
        reason: selectedReason,
        blockUser,
      });
      setSafetySubmitted(
        blockUser ? t('userProfReportBlockedMsg', { name: p.displayName }) : t('userProfReportSentMsg'),
      );
      animateLayout();
      setShowSafetyPanel(false);
    } catch (err) {
      setSafetyError(err instanceof Error ? err.message : t('userProfReportErr'));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      {isBlocked ? (
        <Card variant="flat" style={{ backgroundColor: colors.dangerSoft, borderColor: colors.danger, gap: spacing.xs }}>
          <Badge label={t('userProfBlockedBadge')} fg={colors.danger} bg={colors.surface} icon="ban-outline" />
          <Text variant="caption" color={colors.danger}>
            {t('userProfBlockedBody')}
          </Text>
        </Card>
      ) : null}

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
      </Card>

      {/* Skills */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.sm }}>
          <Badge label={t('userProfCanTeachBadge')} fg={colors.primary} bg={colors.primarySoft} icon="easel-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {offers.map((s) => (
              <Chip key={s.skillId} label={skillName(s.skillId, locale)} selected tone={colors.primary} />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Badge label={t('profileWantLearnBadge')} fg={colors.accent} bg={colors.accentSoft} icon="bulb-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {wants.map((s) => {
              const youTeach = viewerOffers.has(s.skillId);
              const name = skillName(s.skillId, locale);
              return (
                <Chip
                  key={s.skillId}
                  label={youTeach ? t('userProfYouTeachTag', { skill: name }) : name}
                  selected
                  tone={youTeach ? colors.accent : colors.textMuted}
                />
              );
            })}
          </View>
        </View>
        <Text variant="caption" color={colors.textMuted}>
          {t('profileAvailabilityLabel', { summary: p.availabilitySummary })}
        </Text>
      </Card>

      {/* Activities */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('userProfActivitiesTitle', { name: p.displayName.split(' ')[0] })} />
        {(activities.data ?? []).map((a) => (
          <ActivityCard key={a.id} activity={a} instructor={p} />
        ))}
      </View>

      {/* Reviews */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('userProfReviewsTitle')} />
        {(reviews.data ?? []).length === 0 ? (
          <Text variant="caption" color={colors.textMuted}>
            {t('userProfNoReviews')}
          </Text>
        ) : (
          (reviews.data ?? []).map((r) => (
            <Card key={r.id} variant="flat" style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="bodyStrong">{profileMap.get(r.authorId)?.displayName ?? t('commonMember')}</Text>
                <Stars value={r.rating} />
              </View>
              <Text color={colors.text}>{r.comment}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {formatShortDate(r.createdAt, locale)}
              </Text>
            </Card>
          ))
        )}
      </View>

      {/* Trust & Safety */}
      {p.id !== viewerId ? (
        <Card variant="tinted" style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">{t('userProfSafetyTitle')}</Text>
          {safetySubmitted ? (
            <Text variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
              {safetySubmitted}
            </Text>
          ) : showSafetyPanel ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {t('userProfReportReasonPrompt')}
              </Text>
              {reportReasons.map((reason, idx) => (
                <Chip
                  key={reason}
                  label={reason}
                  selected={selectedReasonIdx === idx}
                  tone={colors.danger}
                  onPress={() => setSelectedReasonIdx(idx)}
                />
              ))}
              {safetyError ? (
                <Text variant="caption" color={colors.danger}>
                  {safetyError}
                </Text>
              ) : null}
              <Button
                title={t('userProfReportOnlyBtn')}
                variant="secondary"
                icon="flag-outline"
                loading={reportOrBlock.isPending}
                fullWidth
                onPress={() => handleSafetySubmit(false)}
              />
              <Button
                title={t('userProfReportBlockBtn')}
                variant="danger"
                icon="ban-outline"
                loading={reportOrBlock.isPending}
                fullWidth
                onPress={() => handleSafetySubmit(true)}
              />
            </View>
          ) : (
            <Button
              title={t('userProfReportTriggerBtn')}
              variant="ghost"
              icon="flag-outline"
              onPress={() => {
                animateLayout();
                setShowSafetyPanel(true);
              }}
            />
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
