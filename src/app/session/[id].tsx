import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { PaymentPill } from '../../components/activity';
import { SessionStateBadge } from '../../components/session';
import { formatSessionDate, formatTime } from '../../lib/dates';
import {
  useActivity,
  useCancelSession,
  useCurrentUserId,
  useProfile,
  useRespondToSession,
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
  const respondToSession = useRespondToSession(viewerId);
  const cancelSession = useCancelSession(viewerId);

  const counterpartId =
    session.data && viewerId
      ? session.data.instructorId === viewerId
        ? session.data.learnerId
        : session.data.instructorId
      : undefined;
  const counterpart = useProfile(counterpartId);

  const [showQrPreview, setShowQrPreview] = useState(false);
  const [showCancelBox, setShowCancelBox] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionBanner, setActionBanner] = useState<string | null>(null);

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
  const canInstructorRespond = teaching && s.state === 'requested';
  const canCancel = s.state === 'requested' || s.state === 'confirmed';

  const handleRespond = async (decision: 'confirm' | 'decline') => {
    const updated = await respondToSession.mutateAsync({ sessionId: s.id, decision });
    setActionBanner(
      updated.state === 'confirmed'
        ? 'Confirmaste la sesión. El encuentro quedó agendado.'
        : 'Rechazaste la solicitud. Los créditos en custodia fueron reintegrados al aprendiz.',
    );
  };

  const handleCancel = async () => {
    const res = await cancelSession.mutateAsync({
      sessionId: s.id,
      reason: cancelReason || 'Imprevisto personal',
    });
    setActionBanner(res.refundMessage);
    setShowCancelBox(false);
  };

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

      {actionBanner ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
          <Text variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
            {actionBanner}
          </Text>
        </Card>
      ) : null}

      {/* Schedule & logistics */}
      <Card style={{ gap: spacing.md }}>
        <InfoRow
          icon="calendar-outline"
          label="Fecha y hora (America/Argentina/Buenos_Aires)"
          value={`${formatSessionDate(s.startsAt)} a ${formatTime(s.endsAt)}`}
        />
        <InfoRow icon="location-outline" label="Punto de encuentro" value={a.meetingArea} />
        {s.learnerNote ? <InfoRow icon="chatbubble-outline" label="Nota del aprendiz" value={s.learnerNote} /> : null}
        {s.cancellationReason ? (
          <InfoRow icon="information-circle-outline" label="Motivo de cancelación" value={s.cancellationReason} />
        ) : null}
        <View style={{ gap: 4 }}>
          <Text variant="caption" color={colors.textMuted}>
            Acuerdo de intercambio (congelado al momento de reservar)
          </Text>
          <PaymentPill payment={s.price} />
        </View>
      </Card>

      {/* Instructor confirmation / decline controls */}
      {canInstructorRespond ? (
        <Card style={{ gap: spacing.md, borderColor: colors.accent }}>
          <Badge
            label="SOLICITUD PENDIENTE DE TU RESPUESTA"
            fg={colors.accent}
            bg={colors.accentSoft}
            icon="notifications-outline"
          />
          <Text variant="bodyStrong">
            {counterpart.data?.displayName ?? 'Un miembro'} solicitó tomar esta actividad con vos.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Confirmar sesión"
              icon="checkmark-circle-outline"
              loading={respondToSession.isPending}
              style={{ flex: 1 }}
              onPress={() => handleRespond('confirm')}
            />
            <Button
              title="Rechazar"
              variant="danger"
              icon="close-circle-outline"
              loading={respondToSession.isPending}
              style={{ flex: 1 }}
              onPress={() => handleRespond('decline')}
            />
          </View>
        </Card>
      ) : null}

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

      {/* Cancellation controls & policy */}
      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.sm }}>
        <Text variant="bodyStrong">Política de cancelación y disputas</Text>
        <Text variant="caption" color={colors.textMuted}>
          • Cancelación con más de 24 h de anticipación: reintegro total de créditos en custodia.{'\n'}• Ante ausencias
          o imprevistos de fuerza mayor, los créditos quedan retenidos hasta completar la revisión administrativa: nunca
          se aplican penalidades automáticas irreversibles.
        </Text>
        {canCancel ? (
          showCancelBox ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Motivo de cancelación (opcional)…"
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  minHeight: 44,
                  fontSize: 14,
                  color: colors.text,
                }}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title="Confirmar cancelación"
                  variant="danger"
                  loading={cancelSession.isPending}
                  style={{ flex: 1 }}
                  onPress={handleCancel}
                />
                <Button
                  title="Volver"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() => setShowCancelBox(false)}
                />
              </View>
            </View>
          ) : (
            <Button
              title="Cancelar esta sesión"
              variant="danger"
              icon="ban-outline"
              onPress={() => setShowCancelBox(true)}
            />
          )
        ) : null}
      </Card>
    </Screen>
  );
}
