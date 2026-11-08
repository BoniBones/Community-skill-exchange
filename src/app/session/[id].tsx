import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { PaymentPill } from '../../components/activity';
import { SessionStateBadge } from '../../components/session';
import type { MonetaryPaymentMethod } from '../../domain/types';
import { formatSessionDate, formatShortDate, formatTime } from '../../lib/dates';
import { formatCredits, formatMoneyCents } from '../../lib/format';
import {
  useActivity,
  useCancelSession,
  useConfirmMonetaryPayment,
  useCurrentUserId,
  useProfile,
  useReportMonetaryPayment,
  useRespondToSession,
  useSession,
  useSessionMonetaryPayment,
  useSubmitCancellationObjection,
} from '../../services/queries';
import { DemoBanner, ErrorState, InfoRow, LoadingState, Screen } from '../../ui/layout';
import { Avatar, Badge, Button, Card, Chip, Ionicons, Text } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: viewerId } = useCurrentUserId();
  const session = useSession(id);
  const activity = useActivity(session.data?.activityId);
  const monetaryPayment = useSessionMonetaryPayment(id);

  const respondToSession = useRespondToSession(viewerId);
  const cancelSession = useCancelSession(viewerId);
  const submitObjection = useSubmitCancellationObjection(viewerId);
  const reportPayment = useReportMonetaryPayment(viewerId);
  const confirmPayment = useConfirmMonetaryPayment(viewerId);

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
  const [simulateLate, setSimulateLate] = useState(false);

  const [objectionText, setObjectionText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<MonetaryPaymentMethod>('mercadopago');
  const [paymentRef, setPaymentRef] = useState('');
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

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
  const mp = monetaryPayment.data;
  const teaching = s.instructorId === viewerId;
  const canInstructorRespond = teaching && s.state === 'requested';
  const canCancel = s.state === 'requested' || s.state === 'confirmed';

  const hasCreditsComponent = s.price.mode === 'credits' || s.price.mode === 'mixed';
  const hasMoneyComponent = s.price.mode === 'money' || s.price.mode === 'mixed';
  const inLateReviewWindow =
    s.cancellationTiming === 'late_review_window' || s.state === 'disputed';

  const creditEscrowLabel = (() => {
    if (s.state === 'completed') return 'LIBERADO AL INSTRUCTOR';
    if (s.state === 'declined') return 'REINTEGRADO AL APRENDIZ (SOLICITUD RECHAZADA)';
    if (s.state === 'disputed') return 'PROTEGIDO EN CUSTODIA · EN REVISIÓN ADMINISTRATIVA';
    if (s.state === 'cancelled') {
      return s.cancellationTiming === 'late_review_window'
        ? 'RETENIDO EN VENTANA DE REVISIÓN (48 H · SIN PENALIDAD AUTOMÁTICA)'
        : 'REINTEGRADO AL APRENDIZ (> 24 H)';
    }
    return 'EN CUSTODIA (ESCROW)';
  })();

  const handleRespond = async (decision: 'confirm' | 'decline') => {
    setErrorBanner(null);
    try {
      const updated = await respondToSession.mutateAsync({ sessionId: s.id, decision });
      setActionBanner(
        updated.state === 'confirmed'
          ? 'Confirmaste la sesión. El encuentro quedó agendado.'
          : 'Rechazaste la solicitud. Los créditos en custodia fueron reintegrados al aprendiz.',
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo procesar la respuesta.');
    }
  };

  const handleCancel = async () => {
    setErrorBanner(null);
    try {
      const res = await cancelSession.mutateAsync({
        sessionId: s.id,
        reason: cancelReason || 'Imprevisto personal',
        simulateLateWindow: !teaching && simulateLate,
      });
      setActionBanner(res.refundMessage);
      setShowCancelBox(false);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo cancelar la sesión.');
    }
  };

  const handleSubmitObjection = async () => {
    setErrorBanner(null);
    try {
      await submitObjection.mutateAsync({
        sessionId: s.id,
        reason: objectionText,
      });
      setObjectionText('');
      setActionBanner(
        'Descargo por fuerza mayor registrado. Los créditos permanecen protegidos en custodia hasta la resolución administrativa (sin penalidad automática).',
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo enviar el descargo.');
    }
  };

  const handleReportPayment = async () => {
    setErrorBanner(null);
    try {
      await reportPayment.mutateAsync({
        sessionId: s.id,
        method: paymentMethod,
        externalRef: paymentRef || undefined,
      });
      setActionBanner('Informaste el pago en ARS. El instructor podrá confirmar su recepción.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo informar el pago en ARS.');
    }
  };

  const handleConfirmPayment = async () => {
    setErrorBanner(null);
    try {
      await confirmPayment.mutateAsync({ sessionId: s.id });
      setActionBanner('Confirmaste la recepción del tramo en pesos (ARS).');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo confirmar el pago en ARS.');
    }
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

      {errorBanner ? (
        <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }}>
          <Text variant="caption" color={colors.danger} style={{ fontWeight: '600' }}>
            {errorBanner}
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

      {/* Stage 4: Exchange Economy Breakdown (Separated Credit Escrow + ARS Monetary Tracking) */}
      <Card style={{ gap: spacing.md, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="wallet-outline" size={20} color={colors.primary} />
          <Text variant="heading">Estado del intercambio económico</Text>
        </View>
        <Text variant="caption" color={colors.textMuted}>
          {s.price.mode === 'mixed'
            ? 'Esta sesión utiliza pago mixto: el tramo en créditos comunitarios y el tramo en pesos (ARS) se gestionan en circuitos contables separados.'
            : s.price.mode === 'credits'
              ? 'Esta sesión se intercambia 100% con créditos comunitarios protegidos en custodia (escrow).'
              : 'Esta sesión se abona 100% en pesos argentinos (ARS) acordados directamente con el instructor.'}
        </Text>

        {/* Credits portion */}
        {hasCreditsComponent ? (
          <View
            style={{
              backgroundColor: colors.creditSoft,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: '#FDE68A',
              gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge label="TRAMO EN CRÉDITOS" fg={colors.credit} bg="#FDE68A" icon="time-outline" />
              <Text variant="heading" color={colors.credit}>
                {formatCredits(s.price.creditAmount ?? 0)}
              </Text>
            </View>
            <Text variant="bodyStrong">{creditEscrowLabel}</Text>
            <Text variant="caption" color={colors.textMuted}>
              Clave idempotente: hold:{s.id}
            </Text>
          </View>
        ) : null}

        {/* Monetary (ARS) portion */}
        {hasMoneyComponent ? (
          <View
            style={{
              backgroundColor: colors.moneySoft,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: '#A7F3D0',
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge label="TRAMO EN DINERO (ARS)" fg={colors.money} bg="#A7F3D0" icon="cash-outline" />
              <Text variant="heading" color={colors.money}>
                {formatMoneyCents(s.price.moneyAmountCents ?? 0)}
              </Text>
            </View>

            <Text variant="bodyStrong">
              Estado:{' '}
              {mp?.status === 'confirmed_by_payee'
                ? 'Recepción confirmada por el instructor'
                : mp?.status === 'reported_by_payer'
                  ? 'Pago informado por el aprendiz (pendiente de confirmación)'
                  : mp?.status === 'refunded'
                    ? 'Sin cargo / Reintegrado por cancelación'
                    : mp?.status === 'disputed'
                      ? 'En revisión administrativa (48 h)'
                      : 'Pendiente de abono entre las partes'}
            </Text>

            {mp?.externalRef ? (
              <Text variant="caption" color={colors.text}>
                Referencia / Comprobante: {mp.externalRef}
              </Text>
            ) : null}

            {/* Learner action: report ARS payment */}
            {!teaching &&
            s.state !== 'cancelled' &&
            s.state !== 'declined' &&
            mp?.status !== 'confirmed_by_payee' ? (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.sm,
                  padding: spacing.sm,
                  gap: spacing.sm,
                }}
              >
                <Text variant="caption" color={colors.text} style={{ fontWeight: '600' }}>
                  Informar tu pago en ARS al instructor
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  <Chip
                    label="Mercado Pago / Alias"
                    selected={paymentMethod === 'mercadopago'}
                    onPress={() => setPaymentMethod('mercadopago')}
                  />
                  <Chip
                    label="Efectivo / Transferencia"
                    selected={paymentMethod === 'cash_or_transfer'}
                    onPress={() => setPaymentMethod('cash_or_transfer')}
                  />
                </View>
                <TextInput
                  value={paymentRef}
                  onChangeText={setPaymentRef}
                  placeholder="Comprobante o nota (ej. Alias / # operación)…"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.sm,
                    minHeight: 40,
                    fontSize: 13,
                    color: colors.text,
                  }}
                />
                <Button
                  title={
                    mp?.status === 'reported_by_payer'
                      ? 'Actualizar comprobante en ARS'
                      : 'Informar pago en ARS'
                  }
                  variant="secondary"
                  icon="paper-plane-outline"
                  loading={reportPayment.isPending}
                  onPress={handleReportPayment}
                />
              </View>
            ) : null}

            {/* Instructor action: confirm ARS receipt */}
            {teaching &&
            s.state !== 'cancelled' &&
            s.state !== 'declined' &&
            mp?.status !== 'confirmed_by_payee' ? (
              <Button
                title="Confirmar recepción de ARS"
                icon="checkmark-done-outline"
                loading={confirmPayment.isPending}
                onPress={handleConfirmPayment}
              />
            ) : null}
          </View>
        ) : null}
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

      {/* Stage 4: 48-Hour Late-Cancellation Review Window & Force-Majeure Objection */}
      {inLateReviewWindow ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning, gap: spacing.md }}>
          <Badge
            label="VENTANA DE REVISIÓN DE 48 H · SIN PENALIDAD AUTOMÁTICA"
            fg={colors.warning}
            bg={colors.surface}
            icon="shield-half-outline"
          />
          <Text variant="bodyStrong">
            Esta sesión fue cancelada con menos de 24 h de anticipación.
          </Text>
          <Text variant="caption" color={colors.text}>
            En Community Skill Exchange nunca aplicamos penalidades automáticas irreversibles. Los créditos quedan en
            custodia durante 48 horas
            {s.reviewWindowEndsAt ? ` (hasta el ${formatShortDate(s.reviewWindowEndsAt)})` : ''} para contemplar causas
            de fuerza mayor o acuerdos entre las partes.
          </Text>

          {s.objectionReason ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                padding: spacing.md,
                gap: 4,
              }}
            >
              <Badge
                label="DESCARGO PRESENTADO · EN REVISIÓN"
                fg={colors.primary}
                bg={colors.primarySoft}
                icon="document-text-outline"
              />
              <Text variant="bodyStrong">{s.objectionReason}</Text>
              {s.objectionSubmittedAt ? (
                <Text variant="caption" color={colors.textMuted}>
                  Enviado el {formatShortDate(s.objectionSubmittedAt)}. La transferencia permanece retenida hasta la
                  resolución.
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" color={colors.text} style={{ fontWeight: '600' }}>
                ¿Tuviste un imprevisto de salud, clima o fuerza mayor? Presentá tu descargo dentro de las 48 h:
              </Text>
              <TextInput
                value={objectionText}
                onChangeText={setObjectionText}
                placeholder="Ej. Tormenta fuerte en Santo Tomás / imprevisto médico familiar…"
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
              <Button
                title="Presentar descargo por fuerza mayor"
                icon="shield-checkmark-outline"
                loading={submitObjection.isPending}
                onPress={handleSubmitObjection}
              />
            </View>
          )}
        </Card>
      ) : null}

      {/* Cancellation controls & policy */}
      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.sm }}>
        <Text variant="bodyStrong">Política de cancelación y disputas</Text>
        <Text variant="caption" color={colors.textMuted}>
          • Cancelación con más de 24 h de anticipación: reintegro inmediato del 100% de los créditos en custodia.{'\n'}
          • Cancelación dentro de las 24 h previas: se abre una ventana de revisión de 48 h donde podés presentar un
          descargo por fuerza mayor. Nunca se ejecutan penalidades automáticas irreversibles.
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

              {!teaching ? (
                <View style={{ gap: spacing.xs }}>
                  <Text variant="caption" color={colors.textMuted}>
                    Modalidad de cancelación (permite probar ambos escenarios en la demo):
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    <Chip
                      label="Con > 24 h (reintegro inmediato)"
                      selected={!simulateLate}
                      onPress={() => setSimulateLate(false)}
                    />
                    <Chip
                      label="Simular < 24 h (ventana 48 h)"
                      selected={simulateLate}
                      onPress={() => setSimulateLate(true)}
                    />
                  </View>
                </View>
              ) : null}

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
