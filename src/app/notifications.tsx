import { router } from 'expo-router';
import { View } from 'react-native';

import type { NotificationType } from '../domain/types';
import { formatShortDate } from '../lib/dates';
import { useI18n, type TranslateFn } from '../lib/i18n';
import {
  useCurrentUserId,
  useMarkAllNotificationsRead,
  useNotifications,
} from '../services/queries';
import { DemoBanner, EmptyState, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, IconCircle, Text, type IconName } from '../ui/primitives';
import { spacing, useTheme, type ThemeColors } from '../ui/theme';

function notificationVisual(
  type: NotificationType,
  colors: ThemeColors,
  t: TranslateFn,
): { icon: IconName; color: string; label: string } {
  switch (type) {
    case 'session_requested':
      return { icon: 'calendar-outline', color: colors.accent, label: t('notifTypeRequested') };
    case 'session_confirmed':
      return { icon: 'checkmark-circle-outline', color: colors.primary, label: t('notifTypeConfirmed') };
    case 'session_completed':
      return { icon: 'qr-code-outline', color: colors.primary, label: t('notifTypeCompleted') };
    case 'credit_released':
      return { icon: 'time-outline', color: colors.credit, label: t('notifTypeCredit') };
    case 'review_received':
      return { icon: 'star-outline', color: colors.warning, label: t('notifTypeReview') };
    case 'dispute_opened':
      return { icon: 'shield-half-outline', color: colors.warning, label: t('notifTypeDisputeOpened') };
    case 'dispute_resolved':
      return { icon: 'checkmark-done-circle-outline', color: colors.info, label: t('notifTypeDisputeResolved') };
  }
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const { data: userId } = useCurrentUserId();
  const notifications = useNotifications(userId);
  const markRead = useMarkAllNotificationsRead(userId);

  if (notifications.isLoading) {
    return (
      <Screen>
        <LoadingState label={t('notifLoading')} />
      </Screen>
    );
  }

  const list = notifications.data ?? [];
  const unreadCount = list.filter((n) => !n.readAt).length;

  return (
    <Screen
      refreshing={notifications.isRefetching}
      onRefresh={() => {
        notifications.refetch();
      }}
    >
      <DemoBanner compact />

      <SectionHeader
        title={t('notifTitle')}
        subtitle={t('notifSubtitle')}
        action={
          unreadCount > 0 ? (
            <Button
              title={markRead.isPending ? t('notifMarking') : t('notifMarkAll')}
              variant="secondary"
              icon="checkmark-done-outline"
              disabled={markRead.isPending}
              onPress={() => markRead.mutate()}
            />
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title={t('notifEmptyTitle')}
          message={t('notifEmptyMessage')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {list.map((n) => {
            const visual = notificationVisual(n.type, colors, t);
            const isUnread = !n.readAt;
            return (
              <Card
                key={n.id}
                variant={isUnread ? 'tinted' : 'flat'}
                onPress={
                  n.sessionId
                    ? () => router.push({ pathname: '/session/[id]', params: { id: n.sessionId! } })
                    : undefined
                }
                style={{
                  gap: spacing.sm,
                  borderColor: isUnread ? colors.primary : colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <IconCircle icon={visual.icon} color={visual.color} size={38} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs }}>
                      <Badge label={visual.label} fg={visual.color} bg={colors.bg} />
                      {isUnread ? (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: colors.primary,
                          }}
                        />
                      ) : null}
                    </View>
                    <Text variant="bodyStrong">{n.title}</Text>
                  </View>
                </View>

                <Text color={colors.text}>{n.body}</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" color={colors.textMuted}>
                    {formatShortDate(n.createdAt, locale)}
                  </Text>
                  {n.sessionId ? (
                    <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
                      {t('notifOpenSession')} →
                    </Text>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
