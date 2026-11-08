import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { CreditTxType, MonetaryPaymentStatus } from '../../domain/types';
import { formatShortDate } from '../../lib/dates';
import { formatCredits, formatMoneyCents } from '../../lib/format';
import { useCurrentUserId, useLedgerIntegrity, useMonetaryPayments, useWallet } from '../../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../../ui/layout';
import { Badge, Card, Chip, IconCircle, Ionicons, Text, type IconName } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

const txMeta: Record<CreditTxType, { label: string; icon: IconName; color: string }> = {
  incentive: { label: 'Incentivo de participación', icon: 'sparkles-outline', color: colors.accent },
  hold: { label: 'Reserva de sesión (en custodia)', icon: 'lock-closed-outline', color: colors.info },
  release: { label: 'Sesión verificada (enseñaste)', icon: 'checkmark-circle-outline', color: colors.money },
  refund: { label: 'Reintegro por cancelación', icon: 'arrow-undo-outline', color: colors.primary },
  penalty: { label: 'Penalidad tras revisión', icon: 'alert-circle-outline', color: colors.danger },
  adjustment: { label: 'Ajuste administrativo', icon: 'construct-outline', color: colors.textMuted },
};

const mpStatusMeta: Record<MonetaryPaymentStatus, { label: string; fg: string; bg: string; icon: IconName }> = {
  pending: {
    label: 'PENDIENTE DE PAGO',
    fg: colors.warning,
    bg: colors.warningSoft,
    icon: 'time-outline',
  },
  reported_by_payer: {
    label: 'INFORMADO POR APRENDIZ',
    fg: colors.info,
    bg: colors.infoSoft,
    icon: 'paper-plane-outline',
  },
  confirmed_by_payee: {
    label: 'CONFIRMADO POR INSTRUCTOR',
    fg: colors.money,
    bg: colors.moneySoft,
    icon: 'checkmark-circle-outline',
  },
  disputed: {
    label: 'EN REVISIÓN (48 H)',
    fg: colors.danger,
    bg: colors.dangerSoft,
    icon: 'shield-half-outline',
  },
  refunded: {
    label: 'SIN CARGO / REINTEGRADO',
    fg: colors.textMuted,
    bg: colors.surfaceAlt,
    icon: 'arrow-undo-outline',
  },
};

type LedgerFilter = 'all' | 'pending' | 'earned' | 'spent';

export default function WalletScreen() {
  const { data: userId } = useCurrentUserId();
  const wallet = useWallet(userId);
  const integrity = useLedgerIntegrity(userId);
  const monetaryPayments = useMonetaryPayments(userId);

  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [showInvariants, setShowInvariants] = useState(false);

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
    monetaryPayments.refetch();
  };

  return (
    <Screen refreshing={wallet.isRefetching} onRefresh={handleRefresh}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">Economía de intercambio</Text>
        <Text variant="caption" color={colors.textMuted}>
          1 hora enseñando genera 1 crédito comunitario bajo la modalidad estándar. Los créditos y los pagos en pesos
          (ARS) se contabilizan por separado y nunca existe un tipo de cambio fijo.
        </Text>
      </View>

      {/* Main balance card */}
      <Card style={{ backgroundColor: colors.creditSoft, borderColor: '#FDE68A', gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Badge label="SALDO DISPONIBLE" fg={colors.credit} bg="#FDE68A" icon="time-outline" />
          <Text variant="caption" color={colors.credit}>
            Tope sugerido: {maxBalance} créditos
          </Text>
        </View>
        <Text variant="display" color={colors.credit}>
          {formatCredits(w.available)}
        </Text>

        {/* Circulation bar */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color={colors.textMuted}>
              Nivel de acumulación vs. circulación sugerida
            </Text>
            <Text variant="caption" color={colors.credit} style={{ fontWeight: '600' }}>
              {circulationPct}% ({w.available + w.incomingPending}/{maxBalance} cr)
            </Text>
          </View>
          <View
            style={{
              height: 8,
              backgroundColor: '#FEF3C7',
              borderRadius: radius.pill,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#FDE68A',
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
            {softCapWarning
              ? '¡Estás cerca del tope sugerido! Te invitamos a usar tus créditos tomando una actividad de otro vecino. Este tope promueve la circulación y nunca bloquea tu participación.'
              : 'Los créditos están pensados para circular aprendiendo de otros vecinos en lugar de acumularse indefinidamente.'}
          </Text>
        </View>

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

      {/* Auditable Ledger Integrity Check Card */}
      {integrity.data ? (
        <Card
          onPress={() => setShowInvariants((v) => !v)}
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
                  ? `AUDITORÍA DE PARTIDA DOBLE · ${integrity.data.invariants.length}/${integrity.data.invariants.length} OK`
                  : 'REVISAR INVARIANTES CONTABLES'
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
            {showInvariants
              ? 'Verificación en tiempo real de las 5 reglas contables del libro mayor cerrado de créditos:'
              : 'Tocá para inspeccionar la ecuación de conservación por partida doble, paridad de custodia e idempotencia.'}
          </Text>

          {showInvariants ? (
            <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
              {integrity.data.invariants.map((inv) => (
                <View
                  key={inv.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing.sm,
                    backgroundColor: colors.surface,
                    padding: spacing.sm,
                    borderRadius: radius.sm,
                  }}
                >
                  <Ionicons
                    name={inv.passed ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={inv.passed ? colors.money : colors.danger}
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

      {/* Separated Monetary Payments Section (ARS) */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Acuerdos en dinero (ARS)"
          subtitle="Circuito contable separado para actividades «Solo dinero» o «Pago mixto»"
        />

        {(monetaryPayments.data ?? []).length === 0 ? (
          <Card style={{ backgroundColor: colors.surfaceAlt }}>
            <Text variant="caption" color={colors.textMuted}>
              Todavía no tenés pagos en pesos (ARS) asociados a sesiones en modalidad «Solo dinero» o «Pago mixto».
            </Text>
          </Card>
        ) : (
          (monetaryPayments.data ?? []).map((mp) => {
            const meta = mpStatusMeta[mp.status];
            const isPayee = mp.payeeId === userId;
            return (
              <Card
                key={mp.id}
                onPress={() => router.push({ pathname: '/session/[id]', params: { id: mp.sessionId } })}
                style={{ gap: spacing.xs }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge label={meta.label} fg={meta.fg} bg={meta.bg} icon={meta.icon} />
                  <Text variant="heading" color={isPayee ? colors.money : colors.text}>
                    {isPayee ? '+' : ''}
                    {formatMoneyCents(mp.amountCents)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{mp.activityTitle}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {isPayee ? 'Cobrás como instructor' : 'Abonás como aprendiz'} ·{' '}
                      {mp.method === 'mercadopago' ? 'Mercado Pago / Alias' : 'Efectivo o transferencia'}
                    </Text>
                    {mp.externalRef ? (
                      <Text variant="caption" color={colors.info}>
                        Ref: {mp.externalRef}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Card>
            );
          })
        )}
      </View>

      {/* Credit Ledger history with filters */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Movimientos de créditos"
          subtitle="Registro auditable de créditos ganados, en custodia, gastados y reintegrados"
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <Chip label="Todos" selected={ledgerFilter === 'all'} onPress={() => setLedgerFilter('all')} />
          <Chip
            label="En custodia / Pendientes"
            selected={ledgerFilter === 'pending'}
            onPress={() => setLedgerFilter('pending')}
          />
          <Chip label="Ganados" selected={ledgerFilter === 'earned'} onPress={() => setLedgerFilter('earned')} />
          <Chip
            label="Reservas y reintegros"
            selected={ledgerFilter === 'spent'}
            onPress={() => setLedgerFilter('spent')}
          />
        </View>

        {filteredEntries.map((entry) => {
          const meta = txMeta[entry.type];
          const positive = entry.amount > 0;
          return (
            <Pressable
              key={entry.id}
              disabled={!entry.sessionId}
              onPress={() => {
                if (entry.sessionId) {
                  router.push({ pathname: '/session/[id]', params: { id: entry.sessionId } });
                }
              }}
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
                    <Badge label="EN CUSTODIA" fg={colors.warning} bg={colors.warningSoft} />
                  ) : null}
                </View>
                <Text variant="caption" color={colors.textMuted}>
                  {entry.memo}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Text variant="caption" color={colors.textMuted}>
                    {formatShortDate(entry.createdAt)}
                  </Text>
                  {entry.idempotencyKey ? (
                    <Text variant="caption" color={colors.textMuted}>
                      · clave: {entry.idempotencyKey}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text variant="heading" color={positive ? colors.money : colors.text}>
                {positive ? '+' : ''}
                {formatCredits(entry.amount)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
