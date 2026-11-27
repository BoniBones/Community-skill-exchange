import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { CreditTxType } from '../../domain/types';
import { formatShortDate } from '../../lib/dates';
import { formatCredits } from '../../lib/format';
import { useI18n, type TranslateFn } from '../../lib/i18n';
import { useCurrentUserId, useLedgerIntegrity, useWallet } from '../../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../../ui/layout';
import { Badge, Card, Chip, IconCircle, Ionicons, Text, type IconName } from '../../ui/primitives';
import { animateLayout, radius, spacing, useTheme, type ThemeColors } from '../../ui/theme';

function getTxMeta(
  colors: ThemeColors,
  t: TranslateFn,
): Record<CreditTxType, { label: string; icon: IconName; color: string }> {
  return {
    incentive: { label: t('txIncentive'), icon: 'sparkles-outline', color: colors.accent },
    hold: { label: t('txHold'), icon: 'lock-closed-outline', color: colors.info },
    release: { label: t('txRelease'), icon: 'checkmark-circle-outline', color: colors.success },
    refund: { label: t('txRefund'), icon: 'arrow-undo-outline', color: colors.primary },
    penalty: { label: t('txPenalty'), icon: 'alert-circle-outline', color: colors.danger },
    adjustment: { label: t('txAdjustment'), icon: 'construct-outline', color: colors.textMuted },
  };
}

type LedgerFilter = 'all' | 'pending' | 'earned' | 'spent';

export default function WalletScreen() {
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const { data: userId } = useCurrentUserId();
  const wallet = useWallet(userId);
  const integrity = useLedgerIntegrity(userId);

  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [showInvariants, setShowInvariants] = useState(false);

  if (wallet.isLoading) {
    return (
      <Screen>
        <LoadingState label={t('walletLoading')} />
      </Screen>
    );
  }

  if (wallet.isError || !wallet.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => wallet.refetch()} />
      </Screen>
    );
  }

  const txMeta = getTxMeta(colors, t);
  const w = wallet.data;
  const maxBalance = w.maxBalance ?? 20;
  const circulationPct = Math.min(100, Math.round(((w.available + w.incomingPending) / maxBalance) * 100));
  const softCapWarning = w.available + w.incomingPending >= maxBalance * 0.8;

  const filteredEntries = w.entries.filter((e) => {
    if (ledgerFilter === 'pending') return e.status === 'pending';
    if (ledgerFilter === 'earned') return e.type === 'incentive' || e.type === 'release';
    if (ledgerFilter === 'spent') return e.type === 'hold' || e.type === 'refund' || e.type === 'penalty';
    return true;
  });

  const handleRefresh = () => {
    wallet.refetch();
    integrity.refetch();
  };

  return (
    <Screen refreshing={wallet.isRefetching} onRefresh={handleRefresh}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">{t('walletTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('walletSubtitle')}
        </Text>
      </View>

      {/* Main balance card */}
      <Card style={{ backgroundColor: colors.creditSoft, borderColor: colors.creditBorder, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Badge label={t('walletBalanceBadge')} fg={colors.credit} bg={colors.surface} icon="time-outline" />
          <Text variant="caption" color={colors.credit}>
            {t('walletSuggestedCap', { max: maxBalance })}
          </Text>
        </View>
        <Text variant="display" color={colors.credit}>
          {formatCredits(w.available, locale)}
        </Text>

        {/* Circulation bar */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color={colors.textMuted}>
              {t('walletCirculationLabel')}
            </Text>
            <Text variant="caption" color={colors.credit} style={{ fontWeight: '600' }}>
              {t('walletCirculationValue', {
                pct: circulationPct,
                current: w.available + w.incomingPending,
                max: maxBalance,
              })}
            </Text>
          </View>
          <View
            style={{
              height: 8,
              backgroundColor: colors.surface,
              borderRadius: radius.pill,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.creditBorder,
            }}
          >
            <View
              style={{
                width: `${circulationPct}%`,
                height: '100%',
                backgroundColor: softCapWarning ? colors.warning : colors.credit,
              }}
            />
          </View>
          <Text variant="caption" color={colors.textMuted}>
            {softCapWarning ? t('walletSoftCapWarning') : t('walletCirculationNote')}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.md,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.creditBorder,
          }}
        >
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text variant="caption" color={colors.textMuted}>
              {t('walletHeldEscrow')}
            </Text>
            <Text variant="bodyStrong">{formatCredits(w.heldInEscrow, locale)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text variant="caption" color={colors.textMuted}>
              {t('walletIncomingPending')}
            </Text>
            <Text variant="bodyStrong" color={colors.success}>
              +{formatCredits(w.incomingPending, locale)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Lifetime totals */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Card variant="flat" style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" color={colors.textMuted}>
            {t('walletEarnedTotal')}
          </Text>
          <Text variant="heading" color={colors.success}>
            +{formatCredits(w.earnedTotal, locale)}
          </Text>
        </Card>
        <Card variant="flat" style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" color={colors.textMuted}>
            {t('walletSpentTotal')}
          </Text>
          <Text variant="heading" color={colors.primary}>
            {formatCredits(w.spentTotal, locale)}
          </Text>
        </Card>
      </View>

      {/* Auditable Ledger Integrity Check Card (flattened) */}
      {integrity.data ? (
        <Card
          variant="flat"
          onPress={() => {
            animateLayout();
            setShowInvariants((v) => !v);
          }}
          style={{
            backgroundColor: integrity.data.healthy ? colors.primarySoft : colors.dangerSoft,
            borderColor: integrity.data.healthy ? colors.primary : colors.danger,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge
              label={
                integrity.data.healthy
                  ? t('walletAuditOk', {
                      passed: integrity.data.invariants.length,
                      total: integrity.data.invariants.length,
                    })
                  : t('walletAuditReview')
              }
              fg={integrity.data.healthy ? colors.primary : colors.danger}
              bg={colors.surface}
              icon="shield-checkmark-outline"
            />
            <Ionicons
              name={showInvariants ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={integrity.data.healthy ? colors.primary : colors.danger}
            />
          </View>
          <Text variant="caption" color={colors.text}>
            {showInvariants ? t('walletAuditExpandedSubtitle') : t('walletAuditCollapsedSubtitle')}
          </Text>

          {showInvariants ? (
            <View style={{ marginTop: spacing.xs }}>
              {integrity.data.invariants.map((inv) => (
                <View
                  key={inv.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Ionicons
                    name={inv.passed ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={inv.passed ? colors.success : colors.danger}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{inv.name}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {inv.detail}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Credit Ledger history with filters */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('walletMovementsTitle')} subtitle={t('walletMovementsSubtitle')} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <Chip label={t('walletFilterAll')} selected={ledgerFilter === 'all'} onPress={() => setLedgerFilter('all')} />
          <Chip
            label={t('walletFilterPending')}
            selected={ledgerFilter === 'pending'}
            onPress={() => setLedgerFilter('pending')}
          />
          <Chip
            label={t('walletFilterEarned')}
            selected={ledgerFilter === 'earned'}
            onPress={() => setLedgerFilter('earned')}
          />
          <Chip
            label={t('walletFilterSpent')}
            selected={ledgerFilter === 'spent'}
            onPress={() => setLedgerFilter('spent')}
          />
        </View>

        {filteredEntries.map((entry) => {
          const meta = txMeta[entry.type];
          const positive = entry.amount > 0;
          return (
            <Card
              key={entry.id}
              variant="flat"
              onPress={
                entry.sessionId
                  ? () => router.push({ pathname: '/session/[id]', params: { id: entry.sessionId! } })
                  : undefined
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
              }}
            >
              <IconCircle icon={meta.icon} color={meta.color} size={38} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                  <Text variant="bodyStrong">{meta.label}</Text>
                  {entry.status === 'pending' ? (
                    <Badge label={t('walletPendingBadge')} fg={colors.warning} bg={colors.warningSoft} />
                  ) : null}
                </View>
                <Text variant="caption" color={colors.textMuted}>
                  {entry.memo}
                </Text>
                <Text variant="caption" color={colors.textMuted}>
                  {formatShortDate(entry.createdAt, locale)}
                </Text>
              </View>
              <Text variant="heading" color={positive ? colors.success : colors.text}>
                {positive ? '+' : ''}
                {formatCredits(entry.amount, locale)}
              </Text>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
