import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { PaymentPill, Stars } from '../../components/activity';
import { SessionStateBadge } from '../../components/session';
import type {
  MonetaryPaymentMethod,
  SessionVerificationToken,
  VerificationPhase,
} from '../../domain/types';
import { formatSessionDate, formatShortDate, formatTime } from '../../lib/dates';
import { formatCredits, formatMoneyCents } from '../../lib/format';
import {
  useActivity,
  useCancelSession,
  useConfirmMonetaryPayment,
  useCurrentUserId,
  useIssueSessionToken,
  useProfile,
  useRedeemSessionToken,
  useReportMonetaryPayment,
  useRespondToSession,
  useSession,
  useSessionMonetaryPayment,
  useSessionReviews,
  useSubmitCancellationObjection,
  useSubmitReview,
} from '../../services/queries';
import { DemoBanner, ErrorState, InfoRow, LoadingState, Screen } from '../../ui/layout';
import { Avatar, Badge, Button, Card, Chip, Ionicons, Text } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

/**
 * Pure React Native 9x9 visual QR matrix rendered from the token hash.
 * 100% Expo Go compatible with zero native camera/SVG dependencies required.
 */
function VisualQrMatrix({ hash }: { hash: string }) {
  const size = 9;
  const cells: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      // Corner finder patterns (top-left, top-right, bottom-left 3x3)
      const inTL = r < 3 && c < 3;
      const inTR = r < 3 && c >= size - 3;
      const inBL = r >= size - 3 && c < 3;
      if (inTL || inTR || inBL) {
        const localR = r < 3 ? r : r - (size - 3);
        const localC = c < 3 ? c : c - (size - 3);
        const isBorder = localR === 0 || localR === 2 || localC === 0 || localC === 2;
        const isCenter = localR === 1 && localC === 1;
        row.push(isBorder || isCenter);
      } else {
        const idx = (r * size + c) % Math.max(1, hash.length);
        const code = hash.charCodeAt(idx);
        row.push(code % 2 === 0);
      }
    }
    cells.push(row);
  }

  return (
    <View
      style={{
        padding: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: colors.text,
        gap: 3,
      }}
    >
      {cells.map((row, rIdx) => (
        <View key={rIdx} style={{ flexDirection: 'row', gap: 3 }}>
          {row.map((filled, cIdx) => (
            <View
              key={cIdx}
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: filled ? colors.text : '#F3EEE6',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: viewerId } = useCurrentUserId();
  const session = useSession(id);
  const activity = useActivity(session.data?.activityId);
  const monetaryPayment = useSessionMonetaryPayment(id);
  const sessionReviews = useSessionReviews(id);

  const respondToSession = useRespondToSession(viewerId);
  const cancelSession = useCancelSession(viewerId);
  const submitObjection = useSubmitCancellationObjection(viewerId);
  const reportPayment = useReportMonetaryPayment(viewerId);
  const confirmPayment = useConfirmMonetaryPayment(viewerId);
  const issueToken = useIssueSessionToken(viewerId);
  const redeemToken = useRedeemSessionToken(viewerId);
  const submitReview = useSubmitReview(viewerId);

  const counterpartId =
    session.data && viewerId
      ? session.data.instructorId === viewerId
        ? session.data.learnerId
        : session.data.instructorId
      : undefined;
  const counterpart = useProfile(counterpartId);

  const [activeToken, setActiveToken] = useState<SessionVerificationToken | null>(null);
  const [manualCode, setManualCode] = useState('');

  const [showCancelBox, setShowCancelBox] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [simulateLate, setSimulateLate] = useState(false);

  const [objectionText, setObjectionText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<MonetaryPaymentMethod>('mercadopago');
  const [paymentRef, setPaymentRef] = useState('');

  const [reviewRating, setReviewRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [reviewComment, setReviewComment] = useState('');

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

  const currentPhase: VerificationPhase | null =
    s.state === 'confirmed' ? 'check_in' : s.state === 'in_progress' ? 'check_out' : null;

  const myExistingReview = (sessionReviews.data ?? []).find((r) => r.authorId === viewerId);

  const creditEscrowLabel = (() => {
    if (s.state === 'completed') return 'LIBERADO AL INSTRUCTOR (VERIFICADO CON QR EN 2 ETAPAS)';
    if (s.state === 'declined') return 'REINTEGRADO AL APRENDIZ (SOLICITUD RECHAZADA)';
    if (s.state === 'resolved') return 'RESUELTO POR MODERACIÓN COMUNITARIA';
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

  const handleIssueQr = async (phase: VerificationPhase) => {
    setErrorBanner(null);
    try {
      const tok = await issueToken.mutateAsync({ sessionId: s.id, phase });
      setActiveToken(tok);
      setManualCode(tok.code);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo emitir el código QR.');
    }
  };

  const handleRedeemQr = async (phase: VerificationPhase, codeToUse?: string) => {
    setErrorBanner(null);
    try {
      const code = (codeToUse ?? manualCode).trim();
      const res = await redeemToken.mutateAsync({
        sessionId: s.id,
        phase,
        code: code || activeToken?.code || 'DEMO90',
      });
      setActiveToken(null);
      setManualCode('');
      setActionBanner(res.message);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo validar el código QR.');
    }
  };

  const handleSubmitReview = async () => {
    setErrorBanner(null);
    try {
      await submitReview.mutateAsync({
        sessionId: s.id,
        rating: reviewRating,
        comment: reviewComment,
      });
      setReviewComment('');
      setActionBanner('¡Gracias! Tu reseña verificada fue publicada y sumó a la reputación comunitaria.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo publicar la reseña.');
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
              Clave idempotente: {s.state === 'completed' ? `release:${s.id}` : `hold:${s.id}`}
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

      {/* Stage 5: Interactive Two-Stage Dynamic QR Verification (90s SHA-256 nonces) */}
      <Card style={{ gap: spacing.md, borderColor: colors.primary }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="qr-code-outline" size={22} color={colors.primary} />
            <Text variant="heading">Verificación QR en 2 etapas</Text>
          </View>
          <Badge
            label={
              s.state === 'completed'
                ? '2/2 VERIFICADA'
                : s.state === 'in_progress'
                  ? 'ETAPA 2: CIERRE'
                  : 'ETAPA 1: INICIO'
            }
            fg={s.state === 'completed' ? colors.money : colors.primary}
            bg={s.state === 'completed' ? colors.moneySoft : colors.primarySoft}
            icon="shield-checkmark-outline"
          />
        </View>

        {/* Step indicators */}
        <View style={{ gap: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.surfaceAlt,
              padding: spacing.sm,
              borderRadius: radius.sm,
            }}
          >
            <Ionicons
              name={s.checkedInAt || s.state === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={s.checkedInAt || s.state === 'completed' ? colors.money : colors.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Etapa 1: Check-in de inicio</Text>
              <Text variant="caption" color={colors.textMuted}>
                {s.checkedInAt
                  ? `Verificado a las ${formatTime(s.checkedInAt)}`
                  : s.state === 'completed'
                    ? 'Asistencia de inicio verificada'
                    : 'Confirma que ambos participantes se encontraron'}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.surfaceAlt,
              padding: spacing.sm,
              borderRadius: radius.sm,
            }}
          >
            <Ionicons
              name={s.checkedOutAt || s.state === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={s.checkedOutAt || s.state === 'completed' ? colors.money : colors.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Etapa 2: Check-out de cierre y liberación atómica</Text>
              <Text variant="caption" color={colors.textMuted}>
                {s.checkedOutAt
                  ? `Verificado a las ${formatTime(s.checkedOutAt)} · Custodia liberada`
                  : s.state === 'completed'
                    ? 'Cierre verificado · Créditos transferidos al instructor'
                    : 'Al finalizar, libera los créditos en custodia al instructor'}
              </Text>
            </View>
          </View>
        </View>

        {/* Interactive QR generator & validator for confirmed or in_progress sessions */}
        {currentPhase ? (
          <View style={{ gap: spacing.md }}>
            {activeToken && activeToken.phase === currentPhase ? (
              <View
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  alignItems: 'center',
                  gap: spacing.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Badge
                  label={`TOKEN DINÁMICO DE 90 S · ${currentPhase === 'check_in' ? 'CHECK-IN' : 'CHECK-OUT'}`}
                  fg={colors.primary}
                  bg={colors.primarySoft}
                  icon="time-outline"
                />
                <VisualQrMatrix hash={activeToken.tokenHash} />
                <Text variant="display" style={{ letterSpacing: 4 }}>
                  {activeToken.code}
                </Text>
                <Text variant="caption" color={colors.textMuted} align="center">
                  Hash SHA-256: {activeToken.tokenHash.slice(0, 20)}…{'\n'}
                  Expira a las {formatTime(activeToken.expiresAt)} (uso único)
                </Text>
                <Button
                  title={
                    currentPhase === 'check_in'
                      ? 'Simular escaneo de inicio (Etapa 1/2)'
                      : 'Simular escaneo de cierre y liberar créditos (Etapa 2/2)'
                  }
                  icon="checkmark-done-circle-outline"
                  loading={redeemToken.isPending}
                  fullWidth
                  onPress={() => handleRedeemQr(currentPhase, activeToken.code)}
                />
              </View>
            ) : (
              <Button
                title={
                  currentPhase === 'check_in'
                    ? 'Emitir código QR de inicio (90 s)'
                    : 'Emitir código QR de cierre (90 s)'
                }
                icon="qr-code-outline"
                loading={issueToken.isPending}
                onPress={() => handleIssueQr(currentPhase)}
              />
            )}

            {/* Manual 6-char code redemption */}
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" color={colors.textMuted}>
                ¿Tu contraparte emitió el QR en su celular? Ingresá su código de 6 caracteres:
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TextInput
                  value={manualCode}
                  onChangeText={setManualCode}
                  autoCapitalize="characters"
                  maxLength={8}
                  placeholder="Ej. K9T4M2"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    minHeight: 44,
                    fontSize: 15,
                    fontWeight: '700',
                    color: colors.text,
                  }}
                />
                <Button
                  title="Validar"
                  variant="secondary"
                  loading={redeemToken.isPending}
                  onPress={() => handleRedeemQr(currentPhase)}
                />
              </View>
            </View>
          </View>
        ) : s.state === 'requested' ? (
          <Text variant="caption" color={colors.textMuted}>
            La verificación QR se habilita automáticamente una vez que el instructor confirma la solicitud.
          </Text>
        ) : null}
      </Card>

      {/* Stage 5: Verified Post-Session Review Card */}
      {s.state === 'completed' ? (
        <Card style={{ gap: spacing.md, borderColor: colors.accent }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="heading">Reseña verificada del encuentro</Text>
            <Badge
              label={myExistingReview ? 'PUBLICADA' : 'HABILITADA'}
              fg={colors.accent}
              bg={colors.accentSoft}
              icon="star-outline"
            />
          </View>

          {myExistingReview ? (
            <View
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="bodyStrong">Tu calificación para {counterpart.data?.displayName ?? 'tu vecino'}</Text>
                <Stars value={myExistingReview.rating} />
              </View>
              <Text color={colors.text}>{myExistingReview.comment}</Text>
              <Text variant="caption" color={colors.textMuted}>
                Publicada el {formatShortDate(myExistingReview.createdAt)} · Reseña respaldada por asistencia QR
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                Solo quienes completaron ambas etapas de verificación QR pueden calificar. ¿Cómo fue tu experiencia con{' '}
                {counterpart.data?.displayName ?? 'tu contraparte'}?
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                {([1, 2, 3, 4, 5] as const).map((star) => (
                  <Pressable
                    key={star}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} estrellas`}
                    onPress={() => setReviewRating(star)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: reviewRating >= star ? colors.credit : colors.border,
                      backgroundColor: reviewRating >= star ? colors.creditSoft : colors.surface,
                    }}
                  >
                    <Text variant="bodyStrong" color={reviewRating >= star ? colors.credit : colors.textMuted}>
                      {star} ★
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Contá qué aprendiste o cómo resultó el intercambio…"
                placeholderTextColor={colors.textMuted}
                multiline
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  minHeight: 72,
                  fontSize: 14,
                  color: colors.text,
                  textAlignVertical: 'top',
                }}
              />
              <Button
                title="Publicar reseña verificada"
                icon="star-outline"
                loading={submitReview.isPending}
                onPress={handleSubmitReview}
              />
            </View>
          )}
        </Card>
      ) : null}

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
                gap: 6,
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
              <Button
                title="Ver en panel de moderación comunitaria"
                variant="secondary"
                icon="shield-outline"
                onPress={() => router.push('/admin')}
              />
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
