import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { PaymentPill, Stars } from '../../components/activity';
import { SessionStateBadge } from '../../components/session';
import type { SessionVerificationToken, VerificationPhase } from '../../domain/types';
import { formatSessionDate, formatShortDate, formatTime } from '../../lib/dates';
import { formatCredits } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import {
  isDemoData,
  useActivity,
  useCancelSession,
  useCurrentUserId,
  useIssueSessionToken,
  useProfile,
  useRedeemSessionToken,
  useRespondToSession,
  useSession,
  useSessionReviews,
  useSubmitCancellationObjection,
  useSubmitReview,
} from '../../services/queries';
import { DemoBanner, ErrorState, InfoRow, LoadingState, Screen } from '../../ui/layout';
import { Avatar, Badge, Button, Card, Chip, Ionicons, Text } from '../../ui/primitives';
import { animateLayout, radius, spacing, useTheme } from '../../ui/theme';

/**
 * Pure React Native 9x9 visual QR matrix rendered from the token hash.
 * 100% Expo Go compatible with zero native camera/SVG dependencies required.
 */
function VisualQrMatrix({ hash }: { hash: string }) {
  const { colors } = useTheme();
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
        backgroundColor: colors.surface,
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
                backgroundColor: filled ? colors.text : colors.surfaceAlt,
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
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const { data: viewerId } = useCurrentUserId();
  const session = useSession(id);
  const activity = useActivity(session.data?.activityId);
  const sessionReviews = useSessionReviews(id);

  const respondToSession = useRespondToSession(viewerId);
  const cancelSession = useCancelSession(viewerId);
  const submitObjection = useSubmitCancellationObjection(viewerId);
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

  const [reviewRating, setReviewRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [reviewComment, setReviewComment] = useState('');

  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  if (session.isLoading || activity.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label={t('sesDetLoading')} />
      </Screen>
    );
  }

  if (!session.data || !activity.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message={t('sesDetNotFound')} onRetry={() => session.refetch()} />
      </Screen>
    );
  }

  const s = session.data;
  const a = activity.data;
  const teaching = s.instructorId === viewerId;
  const canInstructorRespond = teaching && s.state === 'requested';
  const canCancel = s.state === 'requested' || s.state === 'confirmed';

  const inLateReviewWindow =
    s.cancellationTiming === 'late_review_window' || s.state === 'disputed';

  const currentPhase: VerificationPhase | null =
    s.state === 'confirmed' ? 'check_in' : s.state === 'in_progress' ? 'check_out' : null;

  const myExistingReview = (sessionReviews.data ?? []).find((r) => r.authorId === viewerId);

  const creditEscrowLabel = (() => {
    if (s.state === 'completed') return t('sesDetEscrowCompleted');
    if (s.state === 'declined') return t('sesDetEscrowDeclined');
    if (s.state === 'resolved') return t('sesDetEscrowResolved');
    if (s.state === 'disputed') return t('sesDetEscrowDisputed');
    if (s.state === 'cancelled') {
      return s.cancellationTiming === 'late_review_window'
        ? t('sesDetEscrowLateCancelled')
        : t('sesDetEscrowTimelyCancelled');
    }
    return t('sesDetEscrowActive');
  })();

  const handleRespond = async (decision: 'confirm' | 'decline') => {
    setErrorBanner(null);
    try {
      const updated = await respondToSession.mutateAsync({ sessionId: s.id, decision });
      setActionBanner(updated.state === 'confirmed' ? t('sesDetConfirmedBanner') : t('sesDetDeclinedBanner'));
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : t('sesDetRespondErr'));
    }
  };

  const handleIssueQr = async (phase: VerificationPhase) => {
    setErrorBanner(null);
    try {
      const tok = await issueToken.mutateAsync({ sessionId: s.id, phase });
      animateLayout();
      setActiveToken(tok);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : t('sesDetQrIssueErr'));
    }
  };

  const handleRedeemQr = async (
    phase: VerificationPhase,
    codeToUse?: string,
    simulateCounterpart = false,
  ) => {
    setErrorBanner(null);
    try {
      const code = (codeToUse ?? manualCode).trim();
      const res = await redeemToken.mutateAsync({
        sessionId: s.id,
        phase,
        code,
        demoScannerId: simulateCounterpart ? counterpartId : undefined,
      });
      animateLayout();
      setActiveToken(null);
      setManualCode('');
      setActionBanner(res.message);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : t('sesDetQrRedeemErr'));
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
      setActionBanner(t('sesDetReviewPublishedBanner'));
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : t('sesDetReviewErr'));
    }
  };

  const handleCancel = async () => {
    setErrorBanner(null);
    try {
      const res = await cancelSession.mutateAsync({
        sessionId: s.id,
        reason: cancelReason || t('sesDetCancelDefaultReason'),
        simulateLateWindow: !teaching && simulateLate,
      });
      setActionBanner(res.refundMessage);
      animateLayout();
      setShowCancelBox(false);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : t('sesDetCancelErr'));
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
      setActionBanner(t('sesDetObjBanner'));
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : t('sesDetObjErr'));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <Badge
          label={teaching ? t('sesDetRoleInstructor') : t('sesDetRoleLearner')}
          fg={teaching ? colors.accent : colors.primary}
          bg={teaching ? colors.accentSoft : colors.primarySoft}
          icon={teaching ? 'easel-outline' : 'book-outline'}
        />
        <SessionStateBadge state={s.state} />
      </View>

      <Text variant="display">{a.title}</Text>

      {actionBanner ? (
        <Card variant="flat" style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
          <Text variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
            {actionBanner}
          </Text>
        </Card>
      ) : null}

      {errorBanner ? (
        <Card variant="flat" style={{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }}>
          <Text variant="caption" color={colors.danger} style={{ fontWeight: '600' }}>
            {errorBanner}
          </Text>
        </Card>
      ) : null}

      {/* Schedule & logistics */}
      <Card style={{ gap: spacing.md }}>
        <InfoRow
          icon="calendar-outline"
          label={t('sesDetWhenLabel')}
          value={t('sesDetWhenRange', {
            start: formatSessionDate(s.startsAt, locale),
            end: formatTime(s.endsAt),
          })}
        />
        <InfoRow icon="location-outline" label={t('sesDetMeetingLabel')} value={a.meetingArea} />
        {s.learnerNote ? <InfoRow icon="chatbubble-outline" label={t('sesDetLearnerNoteLabel')} value={s.learnerNote} /> : null}
        {s.cancellationReason ? (
          <InfoRow icon="information-circle-outline" label={t('sesDetCancelReasonLabel')} value={s.cancellationReason} />
        ) : null}
        <View style={{ gap: 4 }}>
          <Text variant="caption" color={colors.textMuted}>
            {t('sesDetCreditsFrozenLabel')}
          </Text>
          <PaymentPill creditAmount={s.creditAmount} />
        </View>
      </Card>

      {/* Exchange Economy Breakdown (Flattened Integer Credit Escrow) */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="wallet-outline" size={20} color={colors.primary} />
          <Text variant="heading">{t('sesDetEscrowTitle')}</Text>
        </View>
        <Text variant="caption" color={colors.textMuted}>
          {t('sesDetEscrowSubtitle')}
        </Text>

        <View
          style={{
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: spacing.xs,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge
              label={t('sesDetEscrowCreditsBadge')}
              fg={colors.credit}
              bg={colors.creditSoft}
              icon="time-outline"
            />
            <Text variant="heading" color={colors.credit}>
              {formatCredits(s.creditAmount, locale)}
            </Text>
          </View>
          <Text variant="bodyStrong">{creditEscrowLabel}</Text>
        </View>
      </Card>

      {/* Instructor confirmation / decline controls */}
      {canInstructorRespond ? (
        <Card style={{ gap: spacing.md, borderColor: colors.accent }}>
          <Badge
            label={t('sesDetPendingBadge')}
            fg={colors.accent}
            bg={colors.accentSoft}
            icon="notifications-outline"
          />
          <Text variant="bodyStrong">
            {t('sesDetPendingPrompt', { name: counterpart.data?.displayName ?? t('commonMember') })}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title={t('sesDetConfirmBtn')}
              icon="checkmark-circle-outline"
              loading={respondToSession.isPending}
              style={{ flex: 1 }}
              onPress={() => handleRespond('confirm')}
            />
            <Button
              title={t('sesDetDeclineBtn')}
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
          <Avatar name={counterpart.data.displayName} uri={counterpart.data.avatarUrl} size={46} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={colors.textMuted}>
              {teaching ? t('sesDetRoleWhoLearns') : t('sesDetRoleWhoTeaches')}
            </Text>
            <Text variant="heading">{counterpart.data.displayName}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      ) : null}

      {/* Two-Stage Dynamic QR Verification (flattened step rows & QR section) */}
      <Card style={{ gap: spacing.md, borderColor: colors.primary }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
            <Ionicons name="qr-code-outline" size={22} color={colors.primary} />
            <Text variant="heading">{t('sesDetQrTitle')}</Text>
          </View>
          <Badge
            label={
              s.state === 'completed'
                ? t('sesDetQrBadgeDone')
                : s.state === 'in_progress'
                  ? t('sesDetQrBadgeOut')
                  : t('sesDetQrBadgeIn')
            }
            fg={s.state === 'completed' ? colors.success : colors.primary}
            bg={s.state === 'completed' ? colors.successSoft : colors.primarySoft}
            icon="shield-checkmark-outline"
          />
        </View>

        {/* Step indicators separated by clean dividers */}
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Ionicons
              name={s.checkedInAt || s.state === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={s.checkedInAt || s.state === 'completed' ? colors.success : colors.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t('sesDetQrStep1Title')}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {s.checkedInAt
                  ? t('sesDetQrStep1Done', { time: formatTime(s.checkedInAt) })
                  : s.state === 'completed'
                    ? t('sesDetQrStep1DoneNoTime')
                    : t('sesDetQrStep1Pending')}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Ionicons
              name={s.checkedOutAt || s.state === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={s.checkedOutAt || s.state === 'completed' ? colors.success : colors.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t('sesDetQrStep2Title')}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {s.checkedOutAt
                  ? t('sesDetQrStep2Done', { time: formatTime(s.checkedOutAt) })
                  : s.state === 'completed'
                    ? t('sesDetQrStep2DoneNoTime')
                    : t('sesDetQrStep2Pending')}
              </Text>
            </View>
          </View>
        </View>

        {/* Interactive QR generator & validator for confirmed or in_progress sessions */}
        {currentPhase ? (
          <View
            style={{
              gap: spacing.md,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            {activeToken && activeToken.phase === currentPhase ? (
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <Badge
                  label={t('sesDetQrTokenBadge', {
                    phase: currentPhase === 'check_in' ? 'CHECK-IN' : 'CHECK-OUT',
                  })}
                  fg={colors.primary}
                  bg={colors.primarySoft}
                  icon="time-outline"
                />
                <VisualQrMatrix hash={activeToken.tokenHash} />
                <Text variant="display" style={{ letterSpacing: 4 }}>
                  {activeToken.code}
                </Text>
                <Text variant="caption" color={colors.textMuted} align="center">
                  {t('sesDetQrExpiresAt', { time: formatTime(activeToken.expiresAt) })}
                </Text>
                {isDemoData && counterpartId ? (
                  <Button
                    title={
                      currentPhase === 'check_in' ? t('sesDetQrSimCheckIn') : t('sesDetQrSimCheckOut')
                    }
                    icon="checkmark-done-circle-outline"
                    loading={redeemToken.isPending}
                    fullWidth
                    onPress={() => handleRedeemQr(currentPhase, activeToken.code, true)}
                  />
                ) : null}
              </View>
            ) : (
              <Button
                title={currentPhase === 'check_in' ? t('sesDetQrIssueCheckIn') : t('sesDetQrIssueCheckOut')}
                icon="qr-code-outline"
                loading={issueToken.isPending}
                onPress={() => handleIssueQr(currentPhase)}
              />
            )}

            {/* Manual 6-char code redemption */}
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" color={colors.textMuted}>
                {t('sesDetQrManualPrompt')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TextInput
                  value={manualCode}
                  onChangeText={setManualCode}
                  autoCapitalize="characters"
                  maxLength={8}
                  placeholder={t('sesDetQrManualPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    backgroundColor: colors.bg,
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
                  title={t('sesDetQrValidateBtn')}
                  variant="secondary"
                  loading={redeemToken.isPending}
                  onPress={() => handleRedeemQr(currentPhase)}
                />
              </View>
            </View>
          </View>
        ) : s.state === 'requested' ? (
          <Text variant="caption" color={colors.textMuted}>
            {t('sesDetQrWaitConfirm')}
          </Text>
        ) : null}
      </Card>

      {/* Verified Post-Session Review Card (flattened) */}
      {s.state === 'completed' ? (
        <Card style={{ gap: spacing.md, borderColor: colors.accent }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="heading">{t('sesDetReviewTitle')}</Text>
            <Badge
              label={myExistingReview ? t('sesDetReviewPublishedBadge') : t('sesDetReviewEnabledBadge')}
              fg={colors.accent}
              bg={colors.accentSoft}
              icon="star-outline"
            />
          </View>

          {myExistingReview ? (
            <View
              style={{
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                gap: spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="bodyStrong">
                  {t('sesDetReviewYourRating', {
                    name: counterpart.data?.displayName ?? t('sesDetReviewYourCounterpartFallback'),
                  })}
                </Text>
                <Stars value={myExistingReview.rating} />
              </View>
              <Text color={colors.text}>{myExistingReview.comment}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {t('sesDetReviewMeta', { date: formatShortDate(myExistingReview.createdAt, locale) })}
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {t('sesDetReviewPrompt', {
                  name: counterpart.data?.displayName ?? t('sesDetReviewCounterpartFallback'),
                })}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                {([1, 2, 3, 4, 5] as const).map((star) => (
                  <Pressable
                    key={star}
                    accessibilityRole="button"
                    accessibilityLabel={t('starsA11y', { value: star })}
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
                placeholder={t('sesDetReviewPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                style={{
                  backgroundColor: colors.bg,
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
                title={t('sesDetReviewSubmitBtn')}
                icon="star-outline"
                loading={submitReview.isPending}
                onPress={handleSubmitReview}
              />
            </View>
          )}
        </Card>
      ) : null}

      {/* 48-Hour Late-Cancellation Review Window & Force-Majeure Objection (flattened) */}
      {inLateReviewWindow ? (
        <Card variant="flat" style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning, gap: spacing.md }}>
          <Badge
            label={t('sesDetWindowBadge')}
            fg={colors.warning}
            bg={colors.surface}
            icon="shield-half-outline"
          />
          <Text variant="bodyStrong">{t('sesDetWindowTitle')}</Text>
          <Text variant="caption" color={colors.text}>
            {t('sesDetWindowBody', {
              until: s.reviewWindowEndsAt
                ? t('sesDetWindowUntil', { date: formatShortDate(s.reviewWindowEndsAt, locale) })
                : '',
            })}
          </Text>

          {s.objectionReason ? (
            <View
              style={{
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.warningBorder,
                gap: 6,
              }}
            >
              <Badge
                label={t('sesDetObjSubmittedBadge')}
                fg={colors.primary}
                bg={colors.primarySoft}
                icon="document-text-outline"
              />
              <Text variant="bodyStrong">{s.objectionReason}</Text>
              {s.objectionSubmittedAt ? (
                <Text variant="caption" color={colors.textMuted}>
                  {t('sesDetObjSentAt', { date: formatShortDate(s.objectionSubmittedAt, locale) })}
                </Text>
              ) : null}
              <Button
                title={t('sesDetObjViewAdmin')}
                variant="secondary"
                icon="shield-outline"
                onPress={() => router.push('/admin')}
              />
            </View>
          ) : s.state === 'cancelled' && s.cancellationTiming === 'late_review_window' ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.warningBorder }}>
              <Text variant="caption" color={colors.text} style={{ fontWeight: '600' }}>
                {t('sesDetObjPrompt')}
              </Text>
              <TextInput
                value={objectionText}
                onChangeText={setObjectionText}
                placeholder={t('sesDetObjPlaceholder')}
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
                title={t('sesDetObjSubmitBtn')}
                icon="shield-checkmark-outline"
                loading={submitObjection.isPending}
                onPress={handleSubmitObjection}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Cancellation controls & policy */}
      <Card variant="tinted" style={{ gap: spacing.sm }}>
        <Text variant="bodyStrong">{t('sesDetPolicyTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('sesDetPolicyBody')}
        </Text>
        {canCancel ? (
          showCancelBox ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder={t('sesDetCancelPlaceholder')}
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
                    {t('sesDetCancelModePrompt')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    <Chip
                      label={t('sesDetCancelTimelyChip')}
                      selected={!simulateLate}
                      onPress={() => setSimulateLate(false)}
                    />
                    <Chip
                      label={t('sesDetCancelLateChip')}
                      selected={simulateLate}
                      onPress={() => setSimulateLate(true)}
                    />
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title={t('sesDetCancelConfirmBtn')}
                  variant="danger"
                  loading={cancelSession.isPending}
                  style={{ flex: 1 }}
                  onPress={handleCancel}
                />
                <Button
                  title={t('commonBack')}
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() => {
                    animateLayout();
                    setShowCancelBox(false);
                  }}
                />
              </View>
            </View>
          ) : (
            <Button
              title={t('sesDetCancelTriggerBtn')}
              variant="danger"
              icon="ban-outline"
              onPress={() => {
                animateLayout();
                setShowCancelBox(true);
              }}
            />
          )
        ) : null}
      </Card>
    </Screen>
  );
}
