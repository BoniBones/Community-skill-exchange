import { View } from 'react-native';

import type { CreditTxType } from '../../domain/types';
import { formatShortDate } from '../../lib/dates';
import { formatCredits } from '../../lib/format';
import { useCurrentUserId, useWallet } from '../../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../../ui/layout';
import { Badge, Card, IconCircle, Text, type IconName } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

const txMeta: Record<CreditTxType, { label: string; icon: IconName; color: string }> = {
  incentive: { label: 'Incentivo de participación', icon: 'sparkles-outline', color: colors.accent },
  hold: { label: 'Reserva de sesión (en custodia)', icon: 'lock-closed-outline', color: colors.info },
  release: { label: 'Sesión verificada (enseñaste)', icon: 'checkmark-circle-outline', color: colors.money },
  refund: { label: 'Reintegro por cancelación', icon: 'arrow-undo-outline', color: colors.primary },
  penalty: { label: 'Penalidad por cancelación tardía', icon: 'alert-circle-outline', color: colors.danger },
  adjustment: { label: 'Ajuste administrativo', icon: 'construct-outline', color: colors.textMuted },
};

export default function WalletScreen() {
  const { data: userId } = useCurrentUserId();
  const wallet = useWallet(userId);

  if (wallet.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando tus créditos comunitarios…" />
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

  const w = wallet.data;

  return (
    <Screen refreshing={wallet.isRefetching} onRefresh={() => wallet.refetch()}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">Créditos comunitarios</Text>
        <Text variant="caption" color={colors.textMuted}>
          1 hora enseñando genera 1 crédito bajo la modalidad estándar. Los créditos no tienen un valor fijo en pesos.
        </Text>
      </View>

      {/* Main balance card */}
      <Card style={{ backgroundColor: colors.creditSoft, borderColor: '#FDE68A', gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Badge label="SALDO DISPONIBLE" fg={colors.credit} bg="#FDE68A" icon="time-outline" />
          {w.maxBalance ? (
            <Text variant="caption" color={colors.credit}>
              Tope sugerido: {w.maxBalance} créditos
            </Text>
          ) : null}
        </View>
        <Text variant="display" color={colors.credit}>
          {formatCredits(w.available)}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.md,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: '#FDE68A',
          }}
        >
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text variant="caption" color={colors.textMuted}>
              En custodia (reservas)
            </Text>
            <Text variant="bodyStrong">{formatCredits(w.heldInEscrow)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text variant="caption" color={colors.textMuted}>
              Por cobrar (a verificar)
            </Text>
            <Text variant="bodyStrong" color={colors.money}>
              +{formatCredits(w.incomingPending)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Lifetime totals */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Card style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" color={colors.textMuted}>
            Ganados enseñando
          </Text>
          <Text variant="heading" color={colors.money}>
            +{formatCredits(w.earnedTotal)}
          </Text>
        </Card>
        <Card style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" color={colors.textMuted}>
            Usados aprendiendo
          </Text>
          <Text variant="heading" color={colors.primary}>
            {formatCredits(w.spentTotal)}
          </Text>
        </Card>
      </View>

      {/* Explanation of escrow & integrity */}
      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.xs }}>
        <Text variant="bodyStrong">¿Cómo se protegen tus intercambios?</Text>
        <Text variant="caption" color={colors.textMuted}>
          Al reservar una actividad, los créditos quedan en custodia. Solo se transfieren al instructor cuando ambos
          participantes verifican la asistencia con código QR al inicio y al cierre de la sesión.
        </Text>
      </Card>

      {/* Ledger history */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Movimientos de créditos"
          subtitle="Registro auditable de créditos ganados, en custodia, gastados y reintegrados"
        />
        {w.entries.map((entry) => {
          const meta = txMeta[entry.type];
          const positive = entry.amount > 0;
          return (
            <View
              key={entry.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <IconCircle icon={meta.icon} color={meta.color} size={38} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                  <Text variant="bodyStrong">{meta.label}</Text>
                  {entry.status === 'pending' ? (
                    <Badge label="PENDIENTE" fg={colors.warning} bg={colors.warningSoft} />
                  ) : null}
                </View>
                <Text variant="caption" color={colors.textMuted}>
                  {entry.memo}
                </Text>
                <Text variant="caption" color={colors.textMuted}>
                  {formatShortDate(entry.createdAt)}
                </Text>
              </View>
              <Text variant="heading" color={positive ? colors.money : colors.text}>
                {positive ? '+' : ''}
                {formatCredits(entry.amount)}
              </Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
