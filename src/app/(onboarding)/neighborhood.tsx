import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { NEIGHBORHOODS } from '../../domain/catalog';
import { useAuth } from '../../features/auth/authContext';
import { useI18n } from '../../lib/i18n';
import { useCurrentUserId, useNeighborhoods, useVerifyNeighborhoodAccess } from '../../services/queries';
import { DemoBanner, Screen } from '../../ui/layout';
import { Badge, Button, Card, Ionicons, Text } from '../../ui/primitives';
import { radius, spacing, useTheme } from '../../ui/theme';

export default function OnboardingNeighborhoodScreen() {
  const { draft, updateDraft } = useAuth();
  const { data: userId } = useCurrentUserId();
  const neighborhoodsQuery = useNeighborhoods();
  const verifyAccess = useVerifyNeighborhoodAccess(userId);
  const { colors } = useTheme();
  const { t } = useI18n();

  const neighborhoods = neighborhoodsQuery.data ?? NEIGHBORHOODS;
  const firstActive = neighborhoods.find((n) => n.isActive)?.id ?? 'n-santo-tomas';

  const [selectedId, setSelectedId] = useState<string>(
    neighborhoods.some((n) => n.id === draft.neighborhoodId && n.isActive) ? draft.neighborhoodId : firstActive,
  );
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);
    const chosen = neighborhoods.find((n) => n.id === selectedId);
    if (!chosen) {
      setError(t('onbNeighErrSelect'));
      return;
    }
    if (!chosen.isActive) {
      setError(t('onbNeighErrInactive', { name: chosen.name }));
      return;
    }
    if (!accessCode.trim()) {
      setError(t('onbNeighErrCodeEmpty'));
      return;
    }

    try {
      const verifiedProfile = await verifyAccess.mutateAsync({
        neighborhoodId: chosen.id,
        accessCode: accessCode.trim(),
      });
      updateDraft({
        neighborhoodId: verifiedProfile.neighborhoodId,
        neighborhoodVerifiedAt: verifiedProfile.neighborhoodVerifiedAt ?? new Date().toISOString(),
      });
      router.push('/(onboarding)/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('repoErrNeighborhoodCodeInvalid'));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge label={t('onbNeighStepBadge')} fg={colors.primary} bg={colors.primarySoft} icon="key-outline" />
        <Text variant="title">{t('onbNeighTitle')}</Text>
        <Text color={colors.textMuted}>{t('onbNeighSubtitle')}</Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <Text variant="label" color={colors.textMuted}>
          {t('onbNeighSelectLabel')}
        </Text>
        <View style={{ gap: spacing.sm }}>
          {neighborhoods.map((n) => {
            const selected = selectedId === n.id && n.isActive;
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !n.isActive }}
                onPress={() => {
                  if (!n.isActive) {
                    setError(t('onbNeighErrInactive', { name: n.name }));
                    return;
                  }
                  setError(null);
                  setSelectedId(n.id);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : n.isActive ? colors.bg : colors.surfaceAlt,
                  opacity: n.isActive ? 1 : 0.72,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'location-outline'}
                    size={18}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <Text variant="bodyStrong" color={selected ? colors.primary : colors.text}>
                    {n.name}
                  </Text>
                </View>
                <Badge
                  label={n.isActive ? t('onbNeighActiveTag') : t('onbNeighComingSoon')}
                  fg={n.isActive ? colors.success : colors.textMuted}
                  bg={n.isActive ? colors.successSoft : colors.surface}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 6, paddingTop: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            {t('onbNeighCodeLabel')}
          </Text>
          <TextInput
            value={accessCode}
            onChangeText={(txt) => {
              setError(null);
              setAccessCode(txt);
            }}
            placeholder={t('onbNeighCodePlaceholder')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: error ? colors.danger : colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              minHeight: 48,
              fontSize: 18,
              letterSpacing: 3,
              fontWeight: '700',
              color: colors.text,
            }}
          />
          <Text variant="caption" color={colors.textMuted}>
            {t('onbNeighCodeHint')}
          </Text>
        </View>
      </Card>

      {error ? (
        <Card variant="flat" style={{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }}>
          <Text variant="caption" color={colors.danger} style={{ fontWeight: '600' }}>
            {error}
          </Text>
        </Card>
      ) : null}

      <Button
        title={t('onbNeighVerifyBtn')}
        icon="shield-checkmark-outline"
        loading={verifyAccess.isPending}
        fullWidth
        onPress={handleVerify}
      />
    </Screen>
  );
}
