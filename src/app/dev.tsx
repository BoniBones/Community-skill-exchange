import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform, View } from 'react-native';

import { config } from '../lib/config';
import { formatSessionDate } from '../lib/dates';
import { getDeviceLocaleCode, useI18n } from '../lib/i18n';
import { runPilotReadinessAudit } from '../lib/pilotAudit';
import { useCurrentUserId, useLedgerIntegrity } from '../services/queries';
import { checkBackendHealth } from '../services/supabase';
import { InfoRow, Screen } from '../ui/layout';
import { Badge, Button, Card, Text } from '../ui/primitives';
import { spacing, useTheme } from '../ui/theme';

export default function DevDiagnosticsScreen() {
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const { data: userId } = useCurrentUserId();
  const integrity = useLedgerIntegrity(userId);
  const healthQuery = useQuery({
    queryKey: ['backend-health', locale],
    queryFn: checkBackendHealth,
  });

  const health = healthQuery.data;
  const nowIso = new Date().toISOString();
  const invTotal = integrity.data?.invariants.length ?? 5;
  const invPassed = integrity.data?.invariants.filter((i) => i.passed).length ?? 5;
  const pilotAudit = runPilotReadinessAudit({
    ledgerHealthy: integrity.data?.healthy ?? true,
    invariantCount: invTotal,
    passedInvariants: invPassed,
  });

  return (
    <Screen edges={['bottom']}>
      <Text variant="title">{t('devTitle')}</Text>
      <Text variant="caption" color={colors.textMuted}>
        {t('devSubtitle')}
      </Text>

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="heading" style={{ flex: 1 }}>
            {t('devAuditTitle')}
          </Text>
          <Badge
            label={
              pilotAudit.readyForPilot
                ? t('devAuditReady', { passed: pilotAudit.passedCount, total: pilotAudit.totalCount })
                : t('devAuditPending')
            }
            fg={pilotAudit.readyForPilot ? colors.success : colors.warning}
            bg={pilotAudit.readyForPilot ? colors.successSoft : colors.warningSoft}
            icon="rocket-outline"
          />
        </View>
        {pilotAudit.checks.map((c) => (
          <InfoRow
            key={c.id}
            icon={c.passed ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            label={c.title}
            value={c.detail}
          />
        ))}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">{t('devLocaleTzTitle')}</Text>
        <InfoRow icon="globe-outline" label={t('devOfficialTz')} value={config.timeZone} />
        <InfoRow icon="time-outline" label={t('devUtcNow')} value={nowIso} />
        <InfoRow
          icon="calendar-outline"
          label={t('devBaConversion')}
          value={formatSessionDate(nowIso, locale)}
        />
        <InfoRow icon="language-outline" label={t('devDeviceLocale')} value={getDeviceLocaleCode()} />
        <InfoRow
          icon="checkmark-circle-outline"
          label={t('devActiveLocale')}
          value={locale === 'en' ? t('localeEn') : t('localeEsAr')}
        />
        <Button
          title={t('devChangeInSettings')}
          variant="secondary"
          icon="settings-outline"
          onPress={() => router.push('/settings')}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">{t('devRuntimeTitle')}</Text>
        <InfoRow icon="phone-portrait-outline" label={t('devPlatform')} value={`${Platform.OS} (${Platform.Version})`} />
        <InfoRow
          icon="layers-outline"
          label={t('devExpoSdk')}
          value={Constants.expoConfig?.sdkVersion ?? '58.0.0'}
        />
        <InfoRow
          icon="cube-outline"
          label={t('devExecEnv')}
          value={String(Constants.executionEnvironment ?? 'Expo Go')}
        />
        <InfoRow icon="flask-outline" label={t('devDataMode')} value={config.dataMode.toUpperCase()} />
      </Card>

      {integrity.data ? (
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="heading" style={{ flex: 1 }}>
              {t('devLedgerTitle')}
            </Text>
            <Badge
              label={integrity.data.healthy ? t('devLedgerOk') : t('devLedgerErr')}
              fg={integrity.data.healthy ? colors.success : colors.danger}
              bg={integrity.data.healthy ? colors.successSoft : colors.dangerSoft}
              icon="shield-checkmark-outline"
            />
          </View>
          {integrity.data.invariants.map((inv) => (
            <InfoRow
              key={inv.id}
              icon={inv.passed ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              label={inv.name}
              value={inv.detail}
            />
          ))}
          <Button
            title={t('devRunAuditBtn')}
            variant="secondary"
            icon="shield-checkmark-outline"
            loading={integrity.isFetching}
            onPress={() => integrity.refetch()}
          />
        </Card>
      ) : null}

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="heading" style={{ flex: 1 }}>
            {t('devSupabaseTitle')}
          </Text>
          {health ? (
            <Badge
              label={
                health.status === 'ok'
                  ? t('devSbConnected')
                  : health.status === 'not_configured'
                    ? t('devSbDemo')
                    : t('devSbError')
              }
              fg={
                health.status === 'ok'
                  ? colors.success
                  : health.status === 'not_configured'
                    ? colors.warning
                    : colors.danger
              }
              bg={
                health.status === 'ok'
                  ? colors.successSoft
                  : health.status === 'not_configured'
                    ? colors.warningSoft
                    : colors.dangerSoft
              }
            />
          ) : null}
        </View>
        <InfoRow
          icon="server-outline"
          label="EXPO_PUBLIC_SUPABASE_URL"
          value={config.supabaseUrl || t('devSbUrlNotConfigured')}
        />
        <InfoRow
          icon="pulse-outline"
          label={t('devSbResult')}
          value={health ? `${health.detail}${health.latencyMs ? ` · ${health.latencyMs} ms` : ''}` : t('devSbChecking')}
        />
        <Button
          title={t('devTestConnBtn')}
          variant="secondary"
          icon="refresh-outline"
          loading={healthQuery.isFetching}
          onPress={() => healthQuery.refetch()}
        />
      </Card>
    </Screen>
  );
}
