import { router } from 'expo-router';
import { View } from 'react-native';

import type { Activity, Profile, Session, SessionState } from '../domain/types';
import { formatSessionDate } from '../lib/dates';
import { useI18n, type TranslateFn } from '../lib/i18n';
import { Avatar, Badge, Card, Ionicons, Text, type IconName } from '../ui/primitives';
import { spacing, useTheme, type ThemeColors } from '../ui/theme';
import { PaymentPill } from './activity';

/** Labels and colours for every state in the session state machine (docs/ARCHITECTURE.md §5). */
function getSessionStateMeta(
  colors: ThemeColors,
  t: TranslateFn,
): Record<SessionState, { label: string; fg: string; bg: string; icon: IconName }> {
  return {
    requested: { label: t('sessionStateRequested'), fg: colors.info, bg: colors.infoSoft, icon: 'hourglass-outline' },
    confirmed: { label: t('sessionStateConfirmed'), fg: colors.primary, bg: colors.primarySoft, icon: 'checkmark-circle-outline' },
    declined: { label: t('sessionStateDeclined'), fg: colors.textMuted, bg: colors.surfaceAlt, icon: 'close-circle-outline' },
    expired: { label: t('sessionStateExpired'), fg: colors.textMuted, bg: colors.surfaceAlt, icon: 'time-outline' },
    cancelled: { label: t('sessionStateCancelled'), fg: colors.textMuted, bg: colors.surfaceAlt, icon: 'ban-outline' },
    in_progress: { label: t('sessionStateInProgress'), fg: colors.accent, bg: colors.accentSoft, icon: 'play-circle-outline' },
    no_show_pending: { label: t('sessionStateNoShowPending'), fg: colors.warning, bg: colors.warningSoft, icon: 'alert-circle-outline' },
    completed: { label: t('sessionStateCompleted'), fg: colors.success, bg: colors.successSoft, icon: 'ribbon-outline' },
    disputed: { label: t('sessionStateDisputed'), fg: colors.danger, bg: colors.dangerSoft, icon: 'shield-outline' },
    resolved: { label: t('sessionStateResolved'), fg: colors.textMuted, bg: colors.surfaceAlt, icon: 'checkmark-done-outline' },
  };
}

export function SessionStateBadge({ state }: { state: SessionState }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const meta = getSessionStateMeta(colors, t);
  return <Badge {...meta[state]} />;
}

interface SessionCardProps {
  session: Session;
  activity?: Activity | null;
  counterpart?: Profile | null;
  viewerId: string;
}

export function SessionCard({ session, activity, counterpart, viewerId }: SessionCardProps) {
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const teaching = session.instructorId === viewerId;
  return (
    <Card
      onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
      style={{ gap: spacing.md }}
      accessibilityLabel={t('sessionCardA11y', { title: activity?.title ?? '' })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <Badge
          label={teaching ? t('roleTeachingBadge') : t('roleLearningBadge')}
          icon={teaching ? 'easel-outline' : 'book-outline'}
          fg={teaching ? colors.accent : colors.primary}
          bg={teaching ? colors.accentSoft : colors.primarySoft}
        />
        <SessionStateBadge state={session.state} />
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="heading">{activity?.title ?? t('activityFallbackTitle')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>
            {formatSessionDate(session.startsAt, locale)} ({t('buenosAiresTimeHint')})
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        {counterpart ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
            <Avatar name={counterpart.displayName} uri={counterpart.avatarUrl} size={26} />
            <Text variant="caption" style={{ fontWeight: '600' }} numberOfLines={1}>
              {t('withCounterpart', { name: counterpart.displayName })}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <PaymentPill creditAmount={session.creditAmount} size="sm" />
      </View>
    </Card>
  );
}
