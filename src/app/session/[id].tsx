import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PaymentPill } from '../../components/activity';
import { SessionStateBadge } from '../../components/session';
import { formatSessionDate, formatTime } from '../../lib/dates';
import {
  useActivity,
  useCurrentUserId,
  useProfile,
  useSession,
} from '../../services/queries';
import { DemoBanner, ErrorState, InfoRow, LoadingState, Screen } from '../../ui/layout';
import { Avatar, Badge, Button, Card, Ionicons, Text } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: viewerId } = useCurrentUserId();
  const session = useSession(id);
  const activity = useActivity(session.data?.activityId);
  const counterpartId =
    session.data && viewerId
      ? session.data.instructorId === viewerId
        ? session.data.learnerId
        : session.data.instructorId
      : undefined;
  const counterpart = useProfile(counterpartId);
  const [showQrPreview, setShowQrPreview] = useState(false);

  if (session.isLoading || activity.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Cargando sesión…" />
      </Screen>
    );
  }

  if (!session.data || !activity.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="No encontramos esta sesión." onRetry={() => session.refetch()} />
      </Screen>
    );
  }

  const s = session.data;
  const a = activity.data;
  const teaching = s.instructorId === viewerId;

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <Badge
          label={teaching ? 'ROL: INSTRUCTOR' : 'ROL: APRENDIZ'}
          fg={teaching ? colors.accent : colors.primary}
          bg={teaching ? colors.accentSoft : colors.primarySoft}
          icon={teaching ? 'easel-outline' : 'book-outline'}
        />
        <SessionStateBadge state={s.state} />
      </View>

      <Text variant="display">{a.title}</Text>

      {/* Schedule & logistics */}
      <Card style={{ gap: spacing.md }}>
        <InfoRow
          icon="calendar-outline"
          label="Fecha y hora (America/Argentina/Buenos_Aires)"
          value={`${formatSessionDate(s.startsAt)} a ${formatTime(s.endsAt)}`}
        />
        <InfoRow icon="location-outline" label="Punto de encuentro" value={a.meetingArea} />
        <View style={{ gap: 4 }}>
          <Text variant="caption" color={colors.textMuted}>
            Acuerdo de intercambio (congelado al momento de reservar)
          </Text>
          <PaymentPill payment={s.price} />
        </View>
      </Card>

      {/* Counterpart */}
      {counterpart.data ? (
        <Card
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: counterpart.data!.id } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <Avatar name={counterpart.data.displayName} size={46} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={colors.textMuted}>
              {teaching ? 'Quien aprende' : 'Quien enseña'}
            </Text>
            <Text variant="heading">{counterpart.data.displayName}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      ) : null}

      {/* Two-stage QR verification section */}
      <Card style={{ gap: spacing.md, borderColor: colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="qr-code-outline" size={22} color={colors.primary} />
          <Text variant="heading">Verificación de asistencia en 2 etapas</Text>
        </View>
        <Text variant="caption" color={colors.textMuted}>
          1) Al comenzar, ambos confirman presencia con un código QR dinámico (expira en 90 segundos).{'\n'}
          2) Al finalizar la actividad, ambos realizan la verificación de cierre y el backend libera los créditos en
          custodia de forma atómica.
        </Text>

        {showQrPreview ? (
          <View
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              padding: spacing.lg,
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Badge label="VISTA PREVIA · ETAPA 5" fg={colors.warning} bg={colors.warningSoft} icon="flask-outline" />
            <Ionicons name="qr-code" size={96} color={colors.text} />
            <Text variant="caption" color={colors.textMuted} align="center">
              En la Etapa 5 este código se emite desde la función segura «issue_session_token» con vigencia de 90 s y
              hash único para evitar reutilización.
            </Text>
          </View>
        ) : (
          <Button
            title="Ver demostración de verificación QR"
            variant="secondary"
            icon="qr-code-outline"
            onPress={() => setShowQrPreview(true)}
          />
        )}
      </Card>

      {/* Cancellation & dispute policy */}
      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.xs }}>
        <Text variant="bodyStrong">Política de cancelación y disputas</Text>
        <Text variant="caption" color={colors.textMuted}>
          • Cancelación con más de 24 h de anticipación: reintegro total de créditos en custodia.{'\n'}• Ante ausencias
          o imprevistos de fuerza mayor, los créditos quedan retenidos hasta completar la revisión administrativa: nunca
          se aplican penalidades automáticas irreversibles.
        </Text>
      </Card>
    </Screen>
  );
}
