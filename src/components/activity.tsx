import { router } from 'expo-router';
import { View } from 'react-native';

import { categoryOfSkill, getNeighborhood, skillName } from '../domain/catalog';
import type { Activity, MatchKind, PaymentArrangement, Profile } from '../domain/types';
import { formatARS, formatCredits, formatDuration } from '../lib/format';
import { Avatar, Badge, Card, IconCircle, Ionicons, Text, type IconName } from '../ui/primitives';
import { colors, spacing } from '../ui/theme';

/* ───────────────────────── Payment ────────────────────────────── */

/** Shows each accepted form of value separately: credits (amber), money (green). */
export function PaymentPill({ payment, size = 'md' }: { payment: PaymentArrangement; size?: 'sm' | 'md' }) {
  const parts: { icon: IconName; label: string; fg: string; bg: string }[] = [];
  if (payment.mode !== 'money' && payment.creditAmount) {
    parts.push({ icon: 'time-outline', label: formatCredits(payment.creditAmount), fg: colors.credit, bg: colors.creditSoft });
  }
  if (payment.mode !== 'credits' && payment.moneyAmountCents) {
    parts.push({ icon: 'cash-outline', label: formatARS(payment.moneyAmountCents), fg: colors.money, bg: colors.moneySoft });
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {parts.map((p, i) => (
        <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {i > 0 ? (
            <Text variant="caption" color={colors.textMuted}>
              +
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: p.bg,
              borderRadius: 999,
              paddingHorizontal: size === 'sm' ? 8 : 10,
              paddingVertical: size === 'sm' ? 3 : 5,
            }}
          >
            <Ionicons name={p.icon} size={size === 'sm' ? 12 : 14} color={p.fg} />
            <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} color={p.fg} style={{ fontWeight: '700' }}>
              {p.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────── Rating ─────────────────────────────── */

export function Rating({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) {
    return (
      <Badge label="NUEVO EN LA COMUNIDAD" fg={colors.accent} bg={colors.accentSoft} icon="sparkles-outline" />
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={14} color="#F59E0B" />
      <Text variant="caption" style={{ fontWeight: '700' }}>
        {avg.toFixed(1)}
      </Text>
      <Text variant="caption" color={colors.textMuted}>
        ({count})
      </Text>
    </View>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= value ? 'star' : 'star-outline'} size={14} color="#F59E0B" />
      ))}
    </View>
  );
}

/* ───────────────────────── Match reasons ──────────────────────── */

const matchCopy: Record<MatchKind, { label: string; icon: IconName; fg: string; bg: string }> = {
  reciprocal: { label: 'INTERCAMBIO MUTUO', icon: 'swap-horizontal', fg: colors.accent, bg: colors.accentSoft },
  wants_skill: { label: 'QUERÉS APRENDER ESTO', icon: 'heart-outline', fg: colors.primary, bg: colors.primarySoft },
  nearby: { label: 'CERCA TUYO', icon: 'location-outline', fg: colors.info, bg: colors.infoSoft },
};

export function MatchBadges({ reasons }: { reasons: MatchKind[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {reasons.map((r) => (
        <Badge key={r} {...matchCopy[r]} />
      ))}
    </View>
  );
}

/* ───────────────────────── Activity card ──────────────────────── */

interface ActivityCardProps {
  activity: Activity;
  instructor?: Profile | null;
  reasons?: MatchKind[];
  footnote?: string;
}

export function ActivityCard({ activity, instructor, reasons, footnote }: ActivityCardProps) {
  const category = categoryOfSkill(activity.skillId);
  const area = instructor ? getNeighborhood(instructor.neighborhoodId)?.name : undefined;
  return (
    <Card
      onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
      accessibilityLabel={`${activity.title}, ${skillName(activity.skillId)}`}
      style={{ gap: spacing.md }}
    >
      {reasons && reasons.length > 0 ? <MatchBadges reasons={reasons} /> : null}
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        {category ? <IconCircle icon={category.icon as IconName} color={category.color} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{activity.title}</Text>
          <Text variant="caption" color={colors.textMuted}>
            {skillName(activity.skillId)} · {formatDuration(activity.durationMin)}
            {area ? ` · ${area}` : ''}
          </Text>
        </View>
      </View>
      {instructor ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Avatar name={instructor.displayName} size={26} />
          <Text variant="caption" style={{ flex: 1, fontWeight: '600' }}>
            {instructor.displayName}
          </Text>
          <Rating avg={instructor.ratingAvg} count={instructor.ratingCount} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <PaymentPill payment={activity.payment} size="sm" />
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      {footnote ? (
        <Text variant="caption" color={colors.accent} style={{ fontWeight: '600' }}>
          {footnote}
        </Text>
      ) : null}
    </Card>
  );
}
