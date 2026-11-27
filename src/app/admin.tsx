import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { formatShortDate } from '../lib/dates';
import { formatCredits } from '../lib/format';
import { useI18n } from '../lib/i18n';
import {
  useCurrentUserId,
  useDisputes,
  useProfiles,
  useResolveDispute,
  useResolveSafetyReport,
  useSafetyReports,
} from '../services/queries';
import { DemoBanner, EmptyState, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, Text } from '../ui/primitives';
import { radius, spacing, useTheme } from '../ui/theme';

export default function AdminModerationScreen() {
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const { data: userId } = useCurrentUserId();
  const disputes = useDisputes();
  const reports = useSafetyReports();
  const allProfiles = useProfiles();
  const resolveDispute = useResolveDispute(userId);
  const resolveReport = useResolveSafetyReport(userId);

  const [notesByDispute, setNotesByDispute] = useState<Record<string, string>>({});
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const profileMap = useMemo(
    () => new Map((allProfiles.data ?? []).map((p) => [p.id, p])),
    [allProfiles.data],
  );

  if (disputes.isLoading || reports.isLoading) {
    return (
      <Screen>
        <LoadingState label={t('adminLoading')} />
      </Screen>
    );
  }

  const disputeList = disputes.data ?? [];
  const reportList = reports.data ?? [];
  const openDisputes = disputeList.filter((d) => d.status === 'open').length;
  const openReports = reportList.filter((r) => r.status === 'open').length;

  return (
    <Screen
      refreshing={disputes.isRefetching || reports.isRefetching}
      onRefresh={() => {
        disputes.refetch();
        reports.refetch();
        allProfiles.refetch();
      }}
    >
      <DemoBanner compact />

      <Card variant="tinted" style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Badge label={t('adminBadge')} fg={colors.primary} bg={colors.primarySoft} icon="shield-checkmark-outline" />
          <Text variant="caption" color={colors.textMuted}>
            {t('adminRoleLabel')}
          </Text>
        </View>
        <Text variant="bodyStrong">{t('adminTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('adminBody')}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, paddingTop: spacing.xs, flexWrap: 'wrap' }}>
          <Badge
            label={t('adminOpenDisputesCount', { count: openDisputes })}
            fg={openDisputes > 0 ? colors.warning : colors.primary}
            bg={openDisputes > 0 ? colors.warningSoft : colors.primarySoft}
          />
          <Badge
            label={t('adminOpenReportsCount', { count: openReports })}
            fg={openReports > 0 ? colors.danger : colors.textMuted}
            bg={openReports > 0 ? colors.dangerSoft : colors.surface}
          />
        </View>
      </Card>

      {bannerMsg ? (
        <Card variant="flat" style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
          <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
            {bannerMsg}
          </Text>
        </Card>
      ) : null}

      {/* Disputes section */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('adminDisputesTitle')} subtitle={t('adminDisputesSubtitle')} />
        {disputeList.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title={t('adminNoDisputesTitle')}
            message={t('adminNoDisputesMsg')}
          />
        ) : (
          disputeList.map((d) => {
            const learner = profileMap.get(d.learnerId);
            const instructor = profileMap.get(d.instructorId);
            const isOpen = d.status === 'open';
            const noteVal = notesByDispute[d.id] ?? t('adminDefaultNote');

            return (
              <Card
                key={d.id}
                style={{
                  gap: spacing.sm,
                  borderColor: isOpen ? colors.warning : colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                  <Badge
                    label={
                      d.status === 'open'
                        ? t('adminDisputeOpen')
                        : d.status === 'resolved_refund'
                          ? t('adminDisputeRefunded')
                          : t('adminDisputeReleased')
                    }
                    fg={isOpen ? colors.warning : colors.primary}
                    bg={isOpen ? colors.warningSoft : colors.primarySoft}
                    icon={isOpen ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  />
                  <Text variant="caption" color={colors.credit} style={{ fontWeight: '700' }}>
                    {t('adminInEscrow', { credits: formatCredits(d.creditAmount, locale) })}
                  </Text>
                </View>

                <Text variant="bodyStrong">{d.activityTitle}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {t('adminPartiesMeta', {
                    learner: learner?.displayName ?? d.learnerId,
                    instructor: instructor?.displayName ?? d.instructorId,
                    date: formatShortDate(d.createdAt, locale),
                  })}
                </Text>

                <View
                  style={{
                    paddingTop: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    gap: 4,
                  }}
                >
                  <Text variant="caption" color={colors.textMuted}>
                    {t('adminReasonLabel')}
                  </Text>
                  <Text variant="caption" color={colors.text}>
                    “{d.reason}”
                  </Text>
                </View>

                {isOpen ? (
                  <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
                    <Text variant="caption" color={colors.textMuted}>
                      {t('adminNoteLabel')}
                    </Text>
                    <TextInput
                      value={noteVal}
                      onChangeText={(txt) => setNotesByDispute((prev) => ({ ...prev, [d.id]: txt }))}
                      multiline
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        padding: spacing.sm,
                        backgroundColor: colors.bg,
                        color: colors.text,
                        minHeight: 54,
                      }}
                    />
                    <View style={{ gap: spacing.xs }}>
                      <Button
                        title={t('adminRefundBtn')}
                        variant="primary"
                        icon="arrow-undo-outline"
                        fullWidth
                        disabled={resolveDispute.isPending}
                        onPress={() =>
                          resolveDispute.mutate(
                            {
                              disputeId: d.id,
                              resolution: 'resolved_refund',
                              resolutionNote: noteVal,
                            },
                            {
                              onSuccess: () => setBannerMsg(t('adminDisputeRefundBanner', { title: d.activityTitle })),
                            },
                          )
                        }
                      />
                      <Button
                        title={t('adminReleaseBtn')}
                        variant="secondary"
                        icon="checkmark-done-outline"
                        fullWidth
                        disabled={resolveDispute.isPending}
                        onPress={() =>
                          resolveDispute.mutate(
                            {
                              disputeId: d.id,
                              resolution: 'resolved_release',
                              resolutionNote: noteVal,
                            },
                            {
                              onSuccess: () => setBannerMsg(t('adminDisputeReleaseBanner', { title: d.activityTitle })),
                            },
                          )
                        }
                      />
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 4 }}>
                    <Text variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                      {t('adminResolutionLabel', { note: d.resolutionNote ?? '' })}
                    </Text>
                  </View>
                )}

                <Button
                  title={t('adminViewSessionBtn')}
                  variant="ghost"
                  icon="open-outline"
                  onPress={() => router.push({ pathname: '/session/[id]', params: { id: d.sessionId } })}
                />
              </Card>
            );
          })
        )}
      </View>

      {/* Safety reports section */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('adminReportsTitle')} subtitle={t('adminReportsSubtitle')} />
        {reportList.map((r) => {
          const reporter = profileMap.get(r.reporterId);
          const target = profileMap.get(r.targetUserId);
          const isOpen = r.status === 'open';
          return (
            <Card key={r.id} variant="flat" style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge
                  label={
                    r.status === 'open'
                      ? t('adminReportOpen')
                      : r.status === 'reviewed'
                        ? t('adminReportReviewed')
                        : t('adminReportDismissed')
                  }
                  fg={isOpen ? colors.danger : colors.textMuted}
                  bg={isOpen ? colors.dangerSoft : colors.surfaceAlt}
                  icon="flag-outline"
                />
                <Text variant="caption" color={colors.textMuted}>
                  {formatShortDate(r.createdAt, locale)}
                </Text>
              </View>
              <Text variant="bodyStrong">
                {t('adminReportTarget', { name: target?.displayName ?? r.targetUserId })}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {t('adminReportBy', { name: reporter?.displayName ?? r.reporterId })}
              </Text>
              <Text color={colors.text}>{t('adminReportReason', { reason: r.reason })}</Text>
              {isOpen ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Button
                    title={t('adminMarkReviewedBtn')}
                    variant="primary"
                    icon="checkmark-outline"
                    disabled={resolveReport.isPending}
                    onPress={() =>
                      resolveReport.mutate(
                        { reportId: r.id, status: 'reviewed' },
                        { onSuccess: () => setBannerMsg(t('adminReportReviewedBanner')) },
                      )
                    }
                  />
                  <Button
                    title={t('adminDismissBtn')}
                    variant="secondary"
                    icon="close-outline"
                    disabled={resolveReport.isPending}
                    onPress={() =>
                      resolveReport.mutate(
                        { reportId: r.id, status: 'dismissed' },
                        { onSuccess: () => setBannerMsg(t('adminReportDismissedBanner')) },
                      )
                    }
                  />
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
