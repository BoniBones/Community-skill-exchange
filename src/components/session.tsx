import { router } from 'expo-router';
import { View } from 'react-native';

import type { Activity, Profile, Session, SessionState } from '../domain/types';
import { formatSessionDate } from '../lib/dates';
import { Avatar, Badge, Card, Ionicons, Text, type IconName } from '../ui/primitives';
import { colors, spacing } from '../ui/theme';
import { PaymentPill } from './activity';

/** Labels and colours for every state in the session state machine (docs/ARCHITECTURE.md §5). */
export const sessionStateMeta: Record<SessionState, { label: string; fg: string; bg: string; icon: IconName }> = {
  requested: { label: 'SOLICITADA', fg: colors.info, bg: colors.infoSoft, icon: 'hourglass-outline' },
  confirmed: { label: 'CONFIRMADA', fg: colors.primary, bg: colors.primarySoft, icon: 'checkmark-circle-outline' },
  declined: { label: 'RECHAZADA', fg: colors.textMuted, bg: colors.surfaceAlt, icon: 'close-circle-outline' },
  expired: { label: 'VENCIDA', fg: colors.textMuted, bg: colors.surfaceAlt, icon: 'time-outline' },
  cancelled: { label: 'CANCELADA', fg: colors.textMuted, bg: colors.surfaceAlt, icon: 'ban-outline' },
  in_progress: { label: 'EN CURSO', fg: colors.accent, bg: colors.accentSoft, icon: 'play-circle-outline' },
  no_show_pending: { label: 'AUSENCIA EN REVISIÓN', fg: colors.warning, bg: colors.warningSoft, icon: 'alert-circle-outline' },
  completed: { label: 'COMPLETADA', fg: colors.money, bg: colors.moneySoft, icon: 'ribbon-outline' },
  disputed: { label: 'EN DISPUTA', fg: colors.danger, bg: colors.dangerSoft, icon: 'shield-outline' },
  resolved: { label: 'RESUELTA', fg: colors.textMuted, bg: colors.surfaceAlt, icon: 'checkmark-done-outline' },
};

export function SessionStateBadge({ state }: { state: SessionState }) {
  return <Badge {...sessionStateMeta[state]} />;
}

interface SessionCardProps {
  session: Session;
  activity?: Activity | null;
  counterpart?: Profile | null;
  viewerId: string;
}

export function SessionCard({ session, activity, counterpart, viewerId }: SessionCardProps) {
  const teaching = session.instructorId === viewerId;
  return (
    <Card
      onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
      style={{ gap: spacing.md }}
      accessibilityLabel={`Sesión ${activity?.title ?? ''}`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <Badge
          label={teaching ? 'ENSEÑÁS' : 'APRENDÉS'}
          icon={teaching ? 'easel-outline' : 'book-outline'}
          fg={teaching ? colors.accent : colors.primary}
          bg={teaching ? colors.accentSoft : colors.primarySoft}
        />
        <SessionStateBadge state={session.state} />
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="heading">{activity?.title ?? 'Actividad'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>
            {formatSessionDate(session.startsAt)} (hora de Buenos Aires)
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        {counterpart ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
            <Avatar name={counterpart.displayName} size={26} />
            <Text variant="caption" style={{ fontWeight: '600' }} numberOfLines={1}>
              con {counterpart.displayName}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <PaymentPill payment={session.price} size="sm" />
      </View>
    </Card>
  );
}
