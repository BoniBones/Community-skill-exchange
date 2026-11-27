import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { ActivityCard } from '../../components/activity';
import { CATEGORIES, getCategoryColor, getCategoryName, NEIGHBORHOODS, skillName } from '../../domain/catalog';
import type { ActivityFormat, CategoryId, MatchKind } from '../../domain/types';
import { useI18n } from '../../lib/i18n';
import { useActivities, useCurrentUserId, useProfile, useProfiles } from '../../services/queries';
import { DemoBanner, EmptyState, LoadingState, Screen } from '../../ui/layout';
import { Chip, Ionicons, Text } from '../../ui/primitives';
import { radius, spacing, useTheme } from '../../ui/theme';

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ categoryId?: CategoryId }>();
  const { colors, resolvedScheme } = useTheme();
  const { locale, t } = useI18n();
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const allProfiles = useProfiles();

  const [query, setQuery] = useState('');
  const [lastParamCategory, setLastParamCategory] = useState<CategoryId | undefined>(params.categoryId);
  const [categoryId, setCategoryId] = useState<CategoryId | undefined>(params.categoryId);
  const [neighborhoodId, setNeighborhoodId] = useState<string | undefined>();
  const [format, setFormat] = useState<ActivityFormat | undefined>();
  const [onlyReciprocal, setOnlyReciprocal] = useState(false);

  if (params.categoryId !== lastParamCategory) {
    setLastParamCategory(params.categoryId);
    if (params.categoryId) setCategoryId(params.categoryId);
  }

  const activities = useActivities({
    query,
    categoryId,
    neighborhoodId,
    format,
    onlyReciprocal,
  });

  const profileMap = useMemo(
    () => new Map((allProfiles.data ?? []).map((p) => [p.id, p])),
    [allProfiles.data],
  );

  const myOffers = new Set((me.data?.skills ?? []).filter((s) => s.kind === 'offers').map((s) => s.skillId));
  const myWants = new Set((me.data?.skills ?? []).filter((s) => s.kind === 'wants').map((s) => s.skillId));

  const hasFilters = Boolean(query || categoryId || neighborhoodId || format || onlyReciprocal);
  const results = activities.data ?? [];

  return (
    <Screen
      refreshing={activities.isRefetching}
      onRefresh={() => {
        activities.refetch();
        allProfiles.refetch();
      }}
    >
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">{t('exploreTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('exploreSubtitle')}
        </Text>
      </View>

      {/* Search bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.lg,
          minHeight: 46,
        }}
      >
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('exploreSearchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, fontSize: 15, color: colors.text, paddingVertical: 8 }}
        />
      </View>

      {/* Matching & Format quick filter */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          {t('exploreMatchFormatLabel')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip
            label={t('exploreOnlyReciprocal')}
            icon="swap-horizontal"
            selected={onlyReciprocal}
            tone={colors.accent}
            onPress={() => setOnlyReciprocal((v) => !v)}
          />
          <Chip
            label={t('exploreInPerson')}
            icon="people-outline"
            selected={format === 'in_person'}
            onPress={() => setFormat(format === 'in_person' ? undefined : 'in_person')}
          />
          <Chip
            label={t('exploreOnline')}
            icon="videocam-outline"
            selected={format === 'online'}
            onPress={() => setFormat(format === 'online' ? undefined : 'online')}
          />
        </ScrollView>
      </View>

      {/* Neighborhood filter */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          {t('exploreZoneLabel')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label={t('exploreAllZones')} selected={!neighborhoodId} onPress={() => setNeighborhoodId(undefined)} />
          {NEIGHBORHOODS.map((n) => (
            <Chip
              key={n.id}
              label={n.name}
              icon="location-outline"
              selected={neighborhoodId === n.id}
              onPress={() => setNeighborhoodId(neighborhoodId === n.id ? undefined : n.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Category filter */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          {t('exploreCategoryLabel')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label={t('exploreAllCategories')} selected={!categoryId} onPress={() => setCategoryId(undefined)} />
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={getCategoryName(c, locale)}
              selected={categoryId === c.id}
              tone={getCategoryColor(c, resolvedScheme)}
              onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Results */}
      {activities.isLoading ? (
        <LoadingState label={t('exploreLoading')} />
      ) : results.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title={t('exploreEmptyTitle')}
          message={t('exploreEmptyMessage')}
          actionLabel={hasFilters ? t('exploreClearFilters') : undefined}
          onAction={
            hasFilters
              ? () => {
                  setQuery('');
                  setCategoryId(undefined);
                  setNeighborhoodId(undefined);
                  setFormat(undefined);
                  setOnlyReciprocal(false);
                }
              : undefined
          }
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text variant="caption" color={colors.textMuted}>
            {results.length === 1
              ? t('exploreCountSingle', { count: results.length })
              : t('exploreCountPlural', { count: results.length })}
          </Text>
          {results.map((a) => {
            const inst = profileMap.get(a.instructorId);
            const reasons: MatchKind[] = [];
            let footnote: string | undefined;
            if (inst && a.instructorId !== userId) {
              const recip = inst.skills.find((s) => s.kind === 'wants' && myOffers.has(s.skillId));
              if (recip) {
                reasons.push('reciprocal');
                footnote = t('reciprocalFootnote', {
                  name: inst.displayName.split(' ')[0],
                  skill: skillName(recip.skillId, locale),
                });
              }
              if (myWants.has(a.skillId)) reasons.push('wants_skill');
              if (me.data && inst.neighborhoodId === me.data.neighborhoodId) reasons.push('nearby');
            }
            return (
              <ActivityCard
                key={a.id}
                activity={a}
                instructor={inst}
                reasons={reasons}
                footnote={footnote}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}
