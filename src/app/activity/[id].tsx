import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { PaymentPill, Rating } from '../../components/activity';
import { categoryOfSkill, getCategoryColor, getCategoryName, getNeighborhood, skillName } from '../../domain/catalog';
import { formatSessionDate } from '../../lib/dates';
import { formatCredits, formatDuration } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import {
  useActivity,
  useCurrentUserId,
  useProfile,
  useRequestSession,
  useWallet,
} from '../../services/queries';
import { DemoBanner, ErrorState, InfoRow, LoadingState, Screen } from '../../ui/layout';
import { Avatar, Badge, Button, Card, Chip, IconCircle, Ionicons, Text, type IconName } from '../../ui/primitives';
import { radius, spacing, useTheme } from '../../ui/theme';

/** Generates 3 upcoming candidate UTC timestamps at 18:00 / 19:00 / 10:00 Buenos Aires time (UTC−3). */
function generateCandidateSlots(): string[] {
  const slots: string[] = [];
  const offsets = [
    { days: 2, hourBA: 18 },
    { days: 4, hourBA: 19 },
    { days: 5, hourBA: 10 },
  ];
  for (const o of offsets) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + o.days);
    d.setUTCHours(o.hourBA + 3, 0, 0, 0);
    slots.push(d.toISOString());
  }
  return slots;
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, resolvedScheme } = useTheme();
  const { locale, t } = useI18n();
  const { data: viewerId } = useCurrentUserId();
  const activity = useActivity(id);
  const instructor = useProfile(activity.data?.instructorId);
  const viewer = useProfile(viewerId);
  const wallet = useWallet(viewerId);
  const requestSession = useRequestSession(viewerId);

  const candidateSlots = useMemo(() => generateCandidateSlots(), []);
  const [selectedSlot, setSelectedSlot] = useState<string>(candidateSlots[0]!);
  const [learnerNote, setLearnerNote] = useState('');
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  if (activity.isLoading || instructor.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label={t('actDetailLoading')} />
      </Screen>
    );
  }

  if (!activity.data || !instructor.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message={t('actDetailNotFound')} onRetry={() => activity.refetch()} />
      </Screen>
    );
  }

  const a = activity.data;
  const inst = instructor.data;
  const category = categoryOfSkill(a.skillId);
  const categoryColor = category ? getCategoryColor(category, resolvedScheme) : colors.primary;
  const isOwnActivity = a.instructorId === viewerId;

  const formatLabel = {
    in_person: t('actDetailFormatInPerson'),
    online: t('actDetailFormatOnline'),
    either: t('actDetailFormatEither'),
  };

  // Check reciprocal match between viewer and instructor
  const viewerOffers = new Set((viewer.data?.skills ?? []).filter((s) => s.kind === 'offers').map((s) => s.skillId));
  const reciprocalSkill = inst.skills.find((s) => s.kind === 'wants' && viewerOffers.has(s.skillId));

  const handleBook = async () => {
    setBookingError(null);
    try {
      const created = await requestSession.mutateAsync({
        activityId: a.id,
        startsAt: selectedSlot,
        learnerNote,
      });
      setCreatedSessionId(created.id);
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : t('actDetailBookErr'));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      {/* Title & category */}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {category ? <IconCircle icon={category.icon as IconName} color={categoryColor} size={36} /> : null}
          <Text variant="label" color={categoryColor}>
            {(category ? getCategoryName(category, locale) : t('activityFallbackTitle')).toUpperCase()}
          </Text>
        </View>
        <Text variant="display">{a.title}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('actDetailSkillDuration', {
            skill: skillName(a.skillId, locale),
            duration: formatDuration(a.durationMin, locale),
          })}
        </Text>
      </View>

      {/* Reciprocal callout */}
      {!isOwnActivity && reciprocalSkill ? (
        <Card variant="flat" style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, gap: spacing.xs }}>
          <Badge label={t('actDetailReciprocalBadge')} fg={colors.accent} bg={colors.surface} icon="swap-horizontal" />
          <Text variant="bodyStrong" color={colors.accent}>
            {t('actDetailReciprocalTitle', {
              name: inst.displayName.split(' ')[0],
              skill: skillName(reciprocalSkill.skillId, locale),
            })}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {t('actDetailReciprocalBody')}
          </Text>
        </Card>
      ) : null}

      {/* Credits card */}
      <Card style={{ gap: spacing.sm }}>
        <Text variant="label" color={colors.textMuted}>
          {t('actDetailCreditsLabel')}
        </Text>
        <PaymentPill creditAmount={a.creditAmount} />
        <Text variant="caption" color={colors.textMuted}>
          {t('actDetailCreditsBody')}
        </Text>
        {wallet.data ? (
          <Text variant="caption" color={colors.credit} style={{ fontWeight: '600' }}>
            {t('actDetailYourBalance', { balance: formatCredits(wallet.data.available, locale) })}
          </Text>
        ) : null}
      </Card>

      {/* Description & logistics */}
      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">{t('actDetailAboutTitle')}</Text>
        <Text color={colors.text}>{a.description}</Text>
        <InfoRow icon="time-outline" label={t('actDetailDurationLabel')} value={formatDuration(a.durationMin, locale)} />
        <InfoRow icon="calendar-outline" label={t('actDetailAvailabilityLabel')} value={a.availabilitySummary} />
        <InfoRow icon="videocam-outline" label={t('actDetailFormatLabel')} value={formatLabel[a.format]} />
        <InfoRow icon="location-outline" label={t('actDetailMeetingLabel')} value={a.meetingArea} />
        <InfoRow icon="checkmark-circle-outline" label={t('actDetailRequirementsLabel')} value={a.requirements} />
      </Card>

      {/* Instructor card */}
      <Card
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: inst.id } })}
        accessibilityLabel={t('actDetailInstructorA11y', { name: inst.displayName })}
        style={{ gap: spacing.md }}
      >
        <Text variant="label" color={colors.textMuted}>
          {t('actDetailInstructorLabel')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={inst.displayName} uri={inst.avatarUrl} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{inst.displayName}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {t('actDetailCompletedCount', {
                neighborhood: getNeighborhood(inst.neighborhoodId)?.name ?? t('communityPrefix'),
                count: inst.completedSessions,
              })}
            </Text>
            <Rating avg={inst.ratingAvg} count={inst.ratingCount} />
          </View>
        </View>
        <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
          {inst.bio}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
            {t('actDetailViewFullProfile')}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </View>
      </Card>

      {/* Booking section */}
      {isOwnActivity ? (
        <Button
          title={t('actDetailManageMine')}
          variant="secondary"
          icon="settings-outline"
          fullWidth
          onPress={() => router.push('/my-activities')}
        />
      ) : createdSessionId ? (
        <Card variant="flat" style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, gap: spacing.sm }}>
          <Badge
            label={t('actDetailRequestedBadge')}
            fg={colors.primary}
            bg={colors.surface}
            icon="checkmark-circle-outline"
          />
          <Text variant="bodyStrong" color={colors.primary}>
            {t('actDetailRequestedTitle', { date: formatSessionDate(selectedSlot, locale) })}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {t('actDetailRequestedBody', { credits: formatCredits(a.creditAmount, locale) })}
          </Text>
          <Button
            title={t('actDetailOpenSession')}
            icon="calendar-outline"
            fullWidth
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: createdSessionId } })}
          />
        </Card>
      ) : (
        <Card style={{ gap: spacing.md }}>
          <Text variant="heading">{t('actDetailCoordinateTitle')}</Text>
          <Text variant="caption" color={colors.textMuted}>
            {t('actDetailChooseSlot')}
          </Text>
          <View style={{ gap: spacing.xs }}>
            {candidateSlots.map((slot) => (
              <Chip
                key={slot}
                label={formatSessionDate(slot, locale)}
                icon="calendar-outline"
                selected={selectedSlot === slot}
                onPress={() => setSelectedSlot(slot)}
              />
            ))}
          </View>

          <View style={{ gap: 4 }}>
            <Text variant="label" color={colors.textMuted}>
              {t('actDetailNoteLabel', { name: inst.displayName.split(' ')[0].toUpperCase() })}
            </Text>
            <TextInput
              value={learnerNote}
              onChangeText={setLearnerNote}
              placeholder={t('actDetailNotePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                minHeight: 44,
                fontSize: 14,
                color: colors.text,
              }}
            />
          </View>

          {bookingError ? (
            <Text variant="caption" color={colors.danger}>
              {bookingError}
            </Text>
          ) : null}

          <Button
            title={t('actDetailBookBtn', { credits: formatCredits(a.creditAmount, locale) })}
            icon="calendar-outline"
            loading={requestSession.isPending}
            fullWidth
            onPress={handleBook}
          />
        </Card>
      )}
    </Screen>
  );
}
