import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { ActivityCard } from '../../components/activity';
import { CATEGORIES, NEIGHBORHOODS, skillName } from '../../domain/catalog';
import type { ActivityFormat, CategoryId, MatchKind, PaymentMode } from '../../domain/types';
import { paymentModeLabel } from '../../lib/format';
import { profiles } from '../../mocks/data';
import { useActivities, useCurrentUserId, useProfile } from '../../services/queries';
import { DemoBanner, EmptyState, LoadingState, Screen } from '../../ui/layout';
import { Chip, Ionicons, Text } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

const paymentModes: PaymentMode[] = ['credits', 'mixed', 'money'];
const profileMap = new Map(profiles.map((p) => [p.id, p]));

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ categoryId?: CategoryId }>();
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);

  const [query, setQuery] = useState('');
  const [lastParamCategory, setLastParamCategory] = useState<CategoryId | undefined>(params.categoryId);
  const [categoryId, setCategoryId] = useState<CategoryId | undefined>(params.categoryId);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | undefined>();
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
    paymentMode,
    neighborhoodId,
    format,
    onlyReciprocal,
  });

  const myOffers = new Set((me.data?.skills ?? []).filter((s) => s.kind === 'offers').map((s) => s.skillId));
  const myWants = new Set((me.data?.skills ?? []).filter((s) => s.kind === 'wants').map((s) => s.skillId));

  const hasFilters = Boolean(query || categoryId || paymentMode || neighborhoodId || format || onlyReciprocal);

  return (
    <Screen refreshing={activities.isRefetching} onRefresh={() => activities.refetch()}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">Explorar actividades</Text>
        <Text variant="caption" color={colors.textMuted}>
          Filtrá por habilidad, coincidencia recíproca, formato, barrio o modalidad de intercambio.
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
          placeholder="Buscar habilidad, actividad o instructor…"
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, fontSize: 15, color: colors.text, paddingVertical: 8 }}
        />
      </View>

      {/* Matching & Format quick filter */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          EMPAREJAMIENTO Y FORMATO
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip
            label="Solo intercambio mutuo"
            icon="swap-horizontal"
            selected={onlyReciprocal}
            tone={colors.accent}
            onPress={() => setOnlyReciprocal((v) => !v)}
          />
          <Chip
            label="Presencial"
            icon="people-outline"
            selected={format === 'in_person'}
            onPress={() => setFormat(format === 'in_person' ? undefined : 'in_person')}
          />
          <Chip
            label="Online"
            icon="videocam-outline"
            selected={format === 'online'}
            onPress={() => setFormat(format === 'online' ? undefined : 'online')}
          />
        </ScrollView>
      </View>

      {/* Payment mode filter */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          MODALIDAD DE PAGO
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label="Todas" selected={!paymentMode} onPress={() => setPaymentMode(undefined)} />
          {paymentModes.map((m) => (
            <Chip
              key={m}
              label={paymentModeLabel[m]}
              selected={paymentMode === m}
              tone={m === 'credits' ? colors.credit : m === 'money' ? colors.money : colors.primary}
              onPress={() => setPaymentMode(paymentMode === m ? undefined : m)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Neighborhood filter */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          ZONA
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label="Todas las zonas" selected={!neighborhoodId} onPress={() => setNeighborhoodId(undefined)} />
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
          CATEGORÍA
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label="Todas" selected={!categoryId} onPress={() => setCategoryId(undefined)} />
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={categoryId === c.id}
              tone={c.color}
              onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Results */}
      {activities.isLoading ? (
        <LoadingState label="Buscando actividades…" />
      ) : (activities.data ?? []).length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No encontramos actividades con esos filtros"
          message="Probá limpiar los filtros o buscar otra habilidad."
          actionLabel={hasFilters ? 'Limpiar filtros' : undefined}
          onAction={
            hasFilters
              ? () => {
                  setQuery('');
                  setCategoryId(undefined);
                  setPaymentMode(undefined);
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
            {(activities.data ?? []).length} {(activities.data ?? []).length === 1 ? 'actividad' : 'actividades'}{' '}
            disponibles
          </Text>
          {(activities.data ?? []).map((a) => {
            const inst = profileMap.get(a.instructorId);
            const reasons: MatchKind[] = [];
            let footnote: string | undefined;
            if (inst && a.instructorId !== userId) {
              const recip = inst.skills.find((s) => s.kind === 'wants' && myOffers.has(s.skillId));
              if (recip) {
                reasons.push('reciprocal');
                footnote = `💡 ${inst.displayName.split(' ')[0]} quiere aprender ${skillName(recip.skillId)} (que vos enseñás)`;
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
