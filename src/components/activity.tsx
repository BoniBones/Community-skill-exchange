import { router } from 'expo-router';
import { View } from 'react-native';

import { categoryOfSkill, getCategoryColor, getNeighborhood, skillName } from '../domain/catalog';
import type { Activity, MatchKind, Profile } from '../domain/types';
import { formatCredits, formatDuration } from '../lib/format';
import { useI18n, type TranslateFn } from '../lib/i18n';
import { Avatar, Badge, Card, IconCircle, Ionicons, Text, type IconName } from '../ui/primitives';
import { radius, spacing, useTheme, type ThemeColors } from '../ui/theme';

/* ───────────────────────── Payment ────────────────────────────── */

/** Shows the integer community credit amount (1h = 1 credit, non-cashable). */
export function PaymentPill({ creditAmount, size = 'md' }: { creditAmount: number; size?: 'sm' | 'md' }) {
  const { colors } = useTheme();
  const { locale } = useI18n();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        backgroundColor: colors.creditSoft,
        borderRadius: radius.pill,
        paddingHorizontal: size === 'sm' ? 8 : 10,
        paddingVertical: size === 'sm' ? 3 : 5,
      }}
    >
      <Ionicons name="time-outline" size={size === 'sm' ? 12 : 14} color={colors.credit} />
      <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} color={colors.credit} style={{ fontWeight: '700' }}>
        {formatCredits(creditAmount, locale)}
      </Text>
    </View>
  );
}

/* ───────────────────────── Rating ─────────────────────────────── */

export function Rating({ avg, count }: { avg: number | null; count: number }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  if (avg === null || count === 0) {
    return (
      <Badge label={t('ratingNewInCommunity')} fg={colors.accent} bg={colors.accentSoft} icon="sparkles-outline" />
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={14} color={colors.star} />
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
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={t('starsA11y', { value })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= value ? 'star' : 'star-outline'} size={14} color={colors.star} />
      ))}
    </View>
  );
}

/* ───────────────────────── Match reasons ──────────────────────── */

function getMatchMeta(
  colors: ThemeColors,
  t: TranslateFn,
): Record<MatchKind, { label: string; icon: IconName; fg: string; bg: string }> {
  return {
    reciprocal: { label: t('matchReciprocal'), icon: 'swap-horizontal', fg: colors.accent, bg: colors.accentSoft },
    wants_skill: { label: t('matchWantsSkill'), icon: 'heart-outline', fg: colors.primary, bg: colors.primarySoft },
    nearby: { label: t('matchNearby'), icon: 'location-outline', fg: colors.info, bg: colors.infoSoft },
  };
}

export function MatchBadges({ reasons }: { reasons: MatchKind[] }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const matchCopy = getMatchMeta(colors, t);
  const compact = reasons.slice(0, 2);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {compact.map((r) => (
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
  const { colors, resolvedScheme } = useTheme();
  const { locale, t } = useI18n();
  const category = categoryOfSkill(activity.skillId);
  const categoryColor = category ? getCategoryColor(category, resolvedScheme) : colors.primary;
  const area = instructor ? getNeighborhood(instructor.neighborhoodId)?.name : undefined;
  const localizedSkill = skillName(activity.skillId, locale);

  return (
    <Card
      onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
      accessibilityLabel={t('activityCardA11y', { title: activity.title, skill: localizedSkill })}
      style={{ gap: spacing.md }}
    >
      {reasons && reasons.length > 0 ? <MatchBadges reasons={reasons} /> : null}
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        {category ? <IconCircle icon={category.icon as IconName} color={categoryColor} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{activity.title}</Text>
          <Text variant="caption" color={colors.textMuted}>
            {localizedSkill} · {formatDuration(activity.durationMin, locale)}
            {area ? ` · ${area}` : ''}
          </Text>
        </View>
      </View>
      {instructor ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Avatar name={instructor.displayName} uri={instructor.avatarUrl} size={26} />
          <Text variant="caption" style={{ flex: 1, fontWeight: '600' }}>
            {instructor.displayName}
          </Text>
          <Rating avg={instructor.ratingAvg} count={instructor.ratingCount} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <PaymentPill creditAmount={activity.creditAmount} size="sm" />
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      {footnote ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingTop: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Ionicons name="swap-horizontal" size={14} color={colors.accent} />
          <Text variant="caption" color={colors.accent} style={{ flex: 1, fontWeight: '600' }}>
            {footnote}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
