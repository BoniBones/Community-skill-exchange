import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { NotificationType } from '../domain/types';
import { formatShortDate } from '../lib/dates';
import {
  useCurrentUserId,
  useMarkAllNotificationsRead,
  useNotifications,
} from '../services/queries';
import { DemoBanner, EmptyState, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, IconCircle, Text, type IconName } from '../ui/primitives';
import { colors, radius, spacing } from '../ui/theme';

function notificationVisual(type: NotificationType): { icon: IconName; color: string; label: string } {
  switch (type) {
    case 'session_requested':
      return { icon: 'calendar-outline', color: colors.accent, label: 'NUEVA SOLICITUD' };
    case 'session_confirmed':
      return { icon: 'checkmark-circle-outline', color: colors.primary, label: 'CONFIRMADA' };
    case 'session_completed':
      return { icon: 'qr-code-outline', color: colors.primary, label: 'QR VERIFICADO' };
    case 'credit_released':
      return { icon: 'time-outline', color: colors.credit, label: 'CRÉDITO LIBERADO' };
    case 'review_received':
      return { icon: 'star-outline', color: colors.warning, label: 'NUEVA RESEÑA' };
    case 'dispute_opened':
      return { icon: 'shield-half-outline', color: colors.warning, label: 'EN REVISIÓN' };
    case 'dispute_resolved':
      return { icon: 'checkmark-done-circle-outline', color: colors.info, label: 'DISPUTA RESUELTA' };
  }
}

export default function NotificationsScreen() {
  const { data: userId } = useCurrentUserId();
  const notifications = useNotifications(userId);
  const markRead = useMarkAllNotificationsRead(userId);

  if (notifications.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando notificaciones…" />
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
        title="Bandeja de la comunidad"
        subtitle="Avisos de sesiones, liberación de créditos tras doble QR, reseñas y resoluciones"
        action={
          unreadCount > 0 ? (
            <Button
              title={markRead.isPending ? 'Marcando…' : 'Marcar leídas'}
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
          title="Sin notificaciones por ahora"
          message="Cuando recibas solicitudes de sesión, verificaciones QR o reseñas verificadas, aparecerán aquí."
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {list.map((n) => {
            const visual = notificationVisual(n.type);
            const isUnread = !n.readAt;
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                disabled={!n.sessionId}
                onPress={() => {
                  if (n.sessionId) {
                    router.push({ pathname: '/session/[id]', params: { id: n.sessionId } });
                  }
                }}
              >
                <Card
                  style={{
                    gap: spacing.sm,
                    backgroundColor: isUnread ? colors.surfaceAlt : colors.surface,
                    borderColor: isUnread ? colors.primary : colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <IconCircle icon={visual.icon} color={visual.color} size={38} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                        <Badge label={visual.label} fg={visual.color} bg={colors.bg} />
                        {isUnread ? (
                          <View
                            style={{
                              backgroundColor: colors.primary,
                              borderRadius: radius.pill,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                            }}
                          >
                            <Text variant="caption" color="#FFFFFF">
                              NUEVA
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text variant="bodyStrong">{n.title}</Text>
                    </View>
                  </View>

                  <Text color={colors.text}>{n.body}</Text>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="caption" color={colors.textMuted}>
                      {formatShortDate(n.createdAt)}
                    </Text>
                    {n.sessionId ? (
                      <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
                        Abrir sesión →
                      </Text>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
