import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import type { AvailabilityWindow, DayPeriod } from '../domain/types';
import { summarizeAvailability } from '../services/mockRepository';
import { useCurrentUserId, useProfile, useUpdateAvailability } from '../services/queries';
import { DemoBanner, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../ui/primitives';
import { colors, radius, spacing } from '../ui/theme';

const weekdays: { day: AvailabilityWindow['weekday']; label: string }[] = [
  { day: 1, label: 'Lunes' },
  { day: 2, label: 'Martes' },
  { day: 3, label: 'Miércoles' },
  { day: 4, label: 'Jueves' },
  { day: 5, label: 'Viernes' },
  { day: 6, label: 'Sábado' },
  { day: 0, label: 'Domingo' },
];

const periods: { id: DayPeriod; label: string }[] = [
  { id: 'morning', label: 'Mañana (9–12 h)' },
  { id: 'afternoon', label: 'Tarde (15–18 h)' },
  { id: 'evening', label: 'Noche (18–21 h)' },
];

const defaultWindows: AvailabilityWindow[] = [
  { weekday: 2, period: 'afternoon' },
  { weekday: 4, period: 'afternoon' },
];

export default function AvailabilityScreen() {
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const updateAvailability = useUpdateAvailability(userId);

  if (me.isLoading || !me.data) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Cargando disponibilidad…" />
      </Screen>
    );
  }

  return (
    <AvailabilityInner
      initialWindows={me.data.availabilityWindows ?? defaultWindows}
      onSave={updateAvailability.mutateAsync}
      isSaving={updateAvailability.isPending}
    />
  );
}

function AvailabilityInner({
  initialWindows,
  onSave,
  isSaving,
}: {
  initialWindows: AvailabilityWindow[];
  onSave: ReturnType<typeof useUpdateAvailability>['mutateAsync'];
  isSaving: boolean;
}) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>(initialWindows);
  const [customNote, setCustomNote] = useState('');

  const isSelected = (day: AvailabilityWindow['weekday'], period: DayPeriod) =>
    windows.some((w) => w.weekday === day && w.period === period);

  const toggleWindow = (day: AvailabilityWindow['weekday'], period: DayPeriod) => {
    if (isSelected(day, period)) {
      setWindows(windows.filter((w) => !(w.weekday === day && w.period === period)));
    } else {
      setWindows([...windows, { weekday: day, period }]);
    }
  };

  const previewSummary = summarizeAvailability(windows, customNote);

  const handleSave = async () => {
    await onSave({ windows, customNote });
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge
          label="ZONA HORARIA: AMERICA/ARGENTINA/BUENOS_AIRES"
          fg={colors.primary}
          bg={colors.primarySoft}
          icon="time-outline"
        />
        <Text variant="title">Mi disponibilidad horaria</Text>
        <Text variant="caption" color={colors.textMuted}>
          Marcá tus franjas habituales para enseñar y aprender. Esto ayuda a encontrar vecinos con horarios compatibles.
        </Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <SectionHeader
          title="Franjas semanales"
          subtitle="Tocá para activar o desactivar cada bloque horario"
        />
        {weekdays.map((w) => (
          <View
            key={w.day}
            style={{
              gap: spacing.xs,
              paddingBottom: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text variant="bodyStrong">{w.label}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {periods.map((p) => (
                <Chip
                  key={`${w.day}-${p.id}`}
                  label={p.label}
                  selected={isSelected(w.day, p.id)}
                  onPress={() => toggleWindow(w.day, p.id)}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            ACLARACIÓN ADICIONAL (OPCIONAL)
          </Text>
          <TextInput
            value={customNote}
            onChangeText={setCustomNote}
            placeholder="Ej: También puedo coordinar feriados por la mañana"
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              minHeight: 44,
              fontSize: 14,
              color: colors.text,
            }}
          />
        </View>
      </Card>

      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.xs }}>
        <Text variant="caption" color={colors.textMuted}>
          Resumen que verán en tu perfil:
        </Text>
        <Text variant="bodyStrong" color={colors.primary}>
          {previewSummary}
        </Text>
      </Card>

      <Button
        title="Guardar disponibilidad"
        icon="checkmark-circle-outline"
        loading={isSaving}
        fullWidth
        onPress={handleSave}
      />
    </Screen>
  );
}
