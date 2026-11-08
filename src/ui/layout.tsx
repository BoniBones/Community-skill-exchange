import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { isDemoData } from '../services/queries';
import { Button, IconCircle, Ionicons, Text, type IconName } from './primitives';
import { colors, radius, spacing } from './theme';

/* ──────────────────────────── Screen ──────────────────────────── */

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Standard screen container: safe area + warm background + optional scroll. */
export function Screen({ children, scroll = true, edges = ['top'], contentStyle, refreshing, onRefresh }: ScreenProps) {
  const inner = [{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/* ───────────────────────── Section header ─────────────────────── */

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/* ───────────────────────── States ─────────────────────────────── */

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={{ paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
      <ActivityIndicator color={colors.primary} />
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
      <IconCircle icon={icon} color={colors.textMuted} size={56} />
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text color={colors.textMuted} align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="No pudimos cargar esto"
      message={message ?? 'Revisá tu conexión e intentá de nuevo.'}
      actionLabel={onRetry ? 'Reintentar' : undefined}
      onAction={onRetry}
    />
  );
}

/* ───────────────────────── Demo banner ────────────────────────── */

/**
 * Shown whenever data comes from the mock repository, so simulated bookings,
 * credits or auth are never mistaken for real production functionality.
 */
export function DemoBanner({ compact }: { compact?: boolean }) {
  if (!isDemoData) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.warningSoft,
        borderColor: '#FDE68A',
        borderWidth: 1,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: compact ? 6 : spacing.sm,
      }}
    >
      <Ionicons name="flask-outline" size={16} color={colors.warning} />
      <Text variant="caption" color={colors.warning} style={{ flex: 1, fontWeight: '600' }}>
        {compact
          ? 'DATOS DE DEMOSTRACIÓN'
          : 'DATOS DE DEMOSTRACIÓN · Las personas, reservas y créditos son simulados. Nada se guarda.'}
      </Text>
    </View>
  );
}

/* ───────────────────────── Info row ───────────────────────────── */

export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={20} color={colors.primary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" color={colors.textMuted}>
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
      </View>
    </View>
  );
}
