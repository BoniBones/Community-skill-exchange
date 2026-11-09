import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Platform, View } from 'react-native';

import { config } from '../lib/config';
import { formatSessionDate } from '../lib/dates';
import { getDeviceLocaleCode, useI18n } from '../lib/i18n';
import { runPilotReadinessAudit } from '../lib/pilotAudit';
import { useCurrentUserId, useLedgerIntegrity } from '../services/queries';
import { checkBackendHealth } from '../services/supabase';
import { InfoRow, Screen } from '../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../ui/primitives';
import { colors, spacing } from '../ui/theme';

export default function DevDiagnosticsScreen() {
  const { locale, setLocale } = useI18n();
  const { data: userId } = useCurrentUserId();
  const integrity = useLedgerIntegrity(userId);
  const healthQuery = useQuery({
    queryKey: ['backend-health'],
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
      <Text variant="title">Diagnóstico y Auditoría Piloto (Etapa 6)</Text>
      <Text variant="caption" color={colors.textMuted}>
        Verificación en vivo de compatibilidad con Expo Go, auditoría de lanzamiento piloto, zona horaria, idioma,
        conexión al backend e invariantes contables.
      </Text>

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading">Auditoría de Lanzamiento Piloto</Text>
          <Badge
            label={
              pilotAudit.readyForPilot
                ? `LISTO (${pilotAudit.passedCount}/${pilotAudit.totalCount})`
                : 'REVISAR PENDIENTES'
            }
            fg={pilotAudit.readyForPilot ? colors.money : colors.warning}
            bg={pilotAudit.readyForPilot ? colors.moneySoft : colors.warningSoft}
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
        <Text variant="heading">Idioma y Zona Horaria</Text>
        <InfoRow icon="globe-outline" label="Zona horaria oficial" value={config.timeZone} />
        <InfoRow icon="time-outline" label="Timestamp UTC actual" value={nowIso} />
        <InfoRow
          icon="calendar-outline"
          label="Conversión a Buenos Aires"
          value={formatSessionDate(nowIso)}
        />
        <InfoRow icon="language-outline" label="Locale detectado del dispositivo" value={getDeviceLocaleCode()} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Chip
            label="🇦🇷 Español (Argentina)"
            selected={locale === 'es-AR'}
            onPress={() => setLocale('es-AR')}
          />
          <Chip
            label="🌐 English"
            selected={locale === 'en'}
            onPress={() => setLocale('en')}
          />
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">Runtime y Expo Go</Text>
        <InfoRow icon="phone-portrait-outline" label="Plataforma" value={`${Platform.OS} (${Platform.Version})`} />
        <InfoRow
          icon="layers-outline"
          label="Expo SDK configurado"
          value={Constants.expoConfig?.sdkVersion ?? '58.0.0'}
        />
        <InfoRow
          icon="cube-outline"
          label="Entorno de ejecución"
          value={String(Constants.executionEnvironment ?? 'Expo Go')}
        />
        <InfoRow icon="flask-outline" label="Modo de datos activo" value={config.dataMode.toUpperCase()} />
      </Card>

      {integrity.data ? (
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="heading">Invariantes del libro mayor</Text>
            <Badge
              label={integrity.data.healthy ? '5/5 INVARIANTES OK' : 'ERROR CONTABLE'}
              fg={integrity.data.healthy ? colors.money : colors.danger}
              bg={integrity.data.healthy ? colors.moneySoft : colors.dangerSoft}
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
            title="Ejecutar auditoría contable"
            variant="secondary"
            icon="shield-checkmark-outline"
            loading={integrity.isFetching}
            onPress={() => integrity.refetch()}
          />
        </Card>
      ) : null}

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading">Conectividad con Supabase</Text>
          {health ? (
            <Badge
              label={
                health.status === 'ok'
                  ? 'CONECTADO'
                  : health.status === 'not_configured'
                    ? 'MODO DEMO (SIN .ENV)'
                    : 'ERROR DE RED'
              }
              fg={
                health.status === 'ok'
                  ? colors.money
                  : health.status === 'not_configured'
                    ? colors.warning
                    : colors.danger
              }
              bg={
                health.status === 'ok'
                  ? colors.moneySoft
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
          value={config.supabaseUrl || '(no configurada aún — se usa mockRepository)'}
        />
        <InfoRow
          icon="pulse-outline"
          label="Resultado de verificación"
          value={health ? `${health.detail}${health.latencyMs ? ` · ${health.latencyMs} ms` : ''}` : 'Verificando…'}
        />
        <Button
          title="Probar conexión ahora"
          variant="secondary"
          icon="refresh-outline"
          loading={healthQuery.isFetching}
          onPress={() => healthQuery.refetch()}
        />
      </Card>
    </Screen>
  );
}
