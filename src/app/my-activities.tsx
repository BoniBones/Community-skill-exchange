import { router } from 'expo-router';
import { View } from 'react-native';

import { PaymentPill } from '../components/activity';
import { skillName } from '../domain/catalog';
import { formatDuration } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useCurrentUserId, useInstructorActivities, useProfile } from '../services/queries';
import { DemoBanner, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, Ionicons, Text } from '../ui/primitives';
import { spacing, useTheme } from '../ui/theme';

export default function MyActivitiesScreen() {
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const activities = useInstructorActivities(userId);

  if (activities.isLoading || me.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label={t('myActLoading')} />
      </Screen>
    );
  }

  const list = activities.data ?? [];

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">{t('myActTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('myActSubtitle')}
        </Text>
      </View>

      {/* Quick actions */}
      <View style={{ gap: spacing.sm }}>
        <Button
          title={t('myActPublishBtn')}
          icon="add-circle-outline"
          fullWidth
          onPress={() => router.push('/activity-form')}
        />
        <Button
          title={t('myActAvailabilityBtn')}
          variant="secondary"
          icon="calendar-outline"
          fullWidth
          onPress={() => router.push('/availability')}
        />
      </View>

      {/* Credits model explanation */}
      <Card variant="tinted" style={{ gap: spacing.sm }}>
        <Badge label={t('myActModelBadge')} fg={colors.primary} bg={colors.primarySoft} icon="time-outline" />
        <Text variant="bodyStrong">{t('myActModelTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('myActModelBullets')}
        </Text>
      </Card>

      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title={t('myActListTitle', { count: list.length })}
          subtitle={t('myActListSubtitle')}
        />
        {list.map((a) => (
          <Card key={a.id} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge
                label={a.status === 'published' ? t('myActPublishedBadge') : t('myActPausedBadge')}
                fg={a.status === 'published' ? colors.success : colors.textMuted}
                bg={a.status === 'published' ? colors.successSoft : colors.surfaceAlt}
              />
              <Text variant="caption" color={colors.textMuted}>
                {skillName(a.skillId, locale)} · {formatDuration(a.durationMin, locale)}
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              <Text variant="heading">{a.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
                  {a.meetingArea}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
                  {a.availabilitySummary}
                </Text>
              </View>
            </View>
            <PaymentPill creditAmount={a.creditAmount} size="sm" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title={t('commonEdit')}
                variant="secondary"
                icon="create-outline"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/activity-form', params: { id: a.id } })}
              />
              <Button
                title={t('myActPublicViewBtn')}
                variant="ghost"
                icon="open-outline"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/activity/[id]', params: { id: a.id } })}
              />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
