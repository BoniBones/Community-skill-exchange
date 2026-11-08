import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { ActivityCard } from '../../components/activity';
import { CATEGORIES, NEIGHBORHOODS } from '../../domain/catalog';
import type { CategoryId, PaymentMode } from '../../domain/types';
import { paymentModeLabel } from '../../lib/format';
import { profiles } from '../../mocks/data';
import { useActivities } from '../../services/queries';
import { DemoBanner, EmptyState, LoadingState, Screen } from '../../ui/layout';
import { Chip, Ionicons, Text } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

const paymentModes: PaymentMode[] = ['credits', 'mixed', 'money'];
const profileMap = new Map(profiles.map((p) => [p.id, p]));

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ categoryId?: CategoryId }>();
  const [query, setQuery] = useState('');
  const [lastParamCategory, setLastParamCategory] = useState<CategoryId | undefined>(params.categoryId);
  const [categoryId, setCategoryId] = useState<CategoryId | undefined>(params.categoryId);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | undefined>();
  const [neighborhoodId, setNeighborhoodId] = useState<string | undefined>();

  if (params.categoryId !== lastParamCategory) {
    setLastParamCategory(params.categoryId);
    if (params.categoryId) setCategoryId(params.categoryId);
  }

  const activities = useActivities({ query, categoryId, paymentMode, neighborhoodId });

  const hasFilters = Boolean(query || categoryId || paymentMode || neighborhoodId);

  return (
    <Screen refreshing={activities.isRefetching} onRefresh={() => activities.refetch()}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">Explorar actividades</Text>
        <Text variant="caption" color={colors.textMuted}>
          Filtrá por habilidad, barrio o modalidad de intercambio (créditos, dinero o pago mixto).
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
          placeholder="Buscar piano, inglés, karate, cocina…"
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, fontSize: 15, color: colors.text, paddingVertical: 8 }}
        />
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
          {(activities.data ?? []).map((a) => (
            <ActivityCard key={a.id} activity={a} instructor={profileMap.get(a.instructorId)} />
          ))}
        </View>
      )}
    </Screen>
  );
}
