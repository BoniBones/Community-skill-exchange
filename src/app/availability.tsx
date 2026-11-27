import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import type { AvailabilityWindow, DayPeriod } from '../domain/types';
import { useI18n } from '../lib/i18n';
import { summarizeAvailability, useCurrentUserId, useProfile, useUpdateAvailability } from '../services/queries';
import { DemoBanner, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../ui/primitives';
import { radius, spacing, useTheme } from '../ui/theme';

const defaultWindows: AvailabilityWindow[] = [
  { weekday: 2, period: 'afternoon' },
  { weekday: 4, period: 'afternoon' },
];

export default function AvailabilityScreen() {
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const updateAvailability = useUpdateAvailability(userId);
  const { t } = useI18n();

  if (me.isLoading || !me.data) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label={t('availLoading')} />
      </Screen>
    );
  }

  const parsedNote =
    me.data.availabilityNote ??
    (me.data.availabilitySummary.includes(' — ')
      ? me.data.availabilitySummary.split(' — ').slice(1).join(' — ')
      : '');

  return (
    <AvailabilityInner
      initialWindows={me.data.availabilityWindows ?? defaultWindows}
      initialNote={parsedNote}
      onSave={updateAvailability.mutateAsync}
      isSaving={updateAvailability.isPending}
    />
  );
}

function AvailabilityInner({
  initialWindows,
  initialNote,
  onSave,
  isSaving,
}: {
  initialWindows: AvailabilityWindow[];
  initialNote: string;
  onSave: ReturnType<typeof useUpdateAvailability>['mutateAsync'];
  isSaving: boolean;
}) {
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const [windows, setWindows] = useState<AvailabilityWindow[]>(initialWindows);
  const [customNote, setCustomNote] = useState(initialNote);
  const [error, setError] = useState<string | null>(null);

  const weekdays: { day: AvailabilityWindow['weekday']; label: string }[] = [
    { day: 1, label: t('weekday1') },
    { day: 2, label: t('weekday2') },
    { day: 3, label: t('weekday3') },
    { day: 4, label: t('weekday4') },
    { day: 5, label: t('weekday5') },
    { day: 6, label: t('weekday6') },
    { day: 0, label: t('weekday0') },
  ];

  const periods: { id: DayPeriod; label: string }[] = [
    { id: 'morning', label: t('periodMorning') },
    { id: 'afternoon', label: t('periodAfternoon') },
    { id: 'evening', label: t('periodEvening') },
  ];

  const isSelected = (day: AvailabilityWindow['weekday'], period: DayPeriod) =>
    windows.some((w) => w.weekday === day && w.period === period);

  const toggleWindow = (day: AvailabilityWindow['weekday'], period: DayPeriod) => {
    if (isSelected(day, period)) {
      setWindows(windows.filter((w) => !(w.weekday === day && w.period === period)));
    } else {
      setWindows([...windows, { weekday: day, period }]);
    }
  };

  const previewSummary = summarizeAvailability(windows, customNote, locale);

  const handleSave = async () => {
    setError(null);
    try {
      await onSave({ windows, customNote });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorDefault'));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge label={t('availTzBadge')} fg={colors.primary} bg={colors.primarySoft} icon="time-outline" />
        <Text variant="title">{t('availTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('availSubtitle')}
        </Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('availSlotsTitle')} subtitle={t('availSlotsSubtitle')} />
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
            {t('availNoteLabel')}
          </Text>
          <TextInput
            value={customNote}
            onChangeText={setCustomNote}
            placeholder={t('availNotePlaceholder')}
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

      <Card variant="tinted" style={{ gap: spacing.xs }}>
        <Text variant="caption" color={colors.textMuted}>
          {t('availPreviewLabel')}
        </Text>
        <Text variant="bodyStrong" color={colors.primary}>
          {previewSummary}
        </Text>
      </Card>

      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <Button
        title={t('availSaveBtn')}
        icon="checkmark-circle-outline"
        loading={isSaving}
        fullWidth
        onPress={handleSave}
      />
    </Screen>
  );
}
