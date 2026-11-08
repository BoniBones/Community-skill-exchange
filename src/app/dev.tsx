import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Platform, View } from 'react-native';

import { config } from '../lib/config';
import { formatSessionDate } from '../lib/dates';
import { checkBackendHealth } from '../services/supabase';
import { InfoRow, Screen } from '../ui/layout';
import { Badge, Button, Card, Text } from '../ui/primitives';
import { colors, spacing } from '../ui/theme';

export default function DevDiagnosticsScreen() {
  const healthQuery = useQuery({
    queryKey: ['backend-health'],
    queryFn: checkBackendHealth,
  });

  const health = healthQuery.data;
  const nowIso = new Date().toISOString();

  return (
    <Screen edges={['bottom']}>
      <Text variant="title">Diagnóstico del entorno</Text>
      <Text variant="caption" color={colors.textMuted}>
        Verificación en vivo de compatibilidad con Expo Go, zona horaria y conexión al backend de desarrollo.
      </Text>

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

      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">Zona horaria y formato</Text>
        <InfoRow icon="globe-outline" label="Zona horaria oficial" value={config.timeZone} />
        <InfoRow icon="time-outline" label="Timestamp UTC actual" value={nowIso} />
        <InfoRow
          icon="calendar-outline"
          label="Conversión a Buenos Aires"
          value={formatSessionDate(nowIso)}
        />
      </Card>

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
