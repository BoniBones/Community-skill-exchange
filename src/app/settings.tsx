import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
import { SkillCatalogPicker } from '../components/SkillCatalogPicker';
import { getNeighborhood, SKILLS } from '../domain/catalog';
import type { ID, Profile, ProfilePhotoAssetInput, UserSkill } from '../domain/types';
import { useAuth } from '../features/auth/authContext';
import { useI18n } from '../lib/i18n';
import {
  useCreateCustomSkill,
  useCurrentUserId,
  useProfile,
  useRemoveProfilePhoto,
  useSkills,
  useUpdateProfile,
  useUploadProfilePhoto,
} from '../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, Chip, Ionicons, Text } from '../ui/primitives';
import { ACCENT_IDS, ACCENT_PALETTES, FadeInView, radius, spacing, useTheme, type AccentId, type ThemeMode } from '../ui/theme';

export default function SettingsScreen() {
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const skillsQuery = useSkills();
  const createCustomSkill = useCreateCustomSkill(userId);
  const updateProfile = useUpdateProfile(userId);
  const uploadPhoto = useUploadProfilePhoto(userId);
  const removePhoto = useRemoveProfilePhoto(userId);
  const { t } = useI18n();

  if (me.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label={t('profileLoading')} />
      </Screen>
    );
  }

  if (me.isError || !me.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState onRetry={() => me.refetch()} />
      </Screen>
    );
  }

  return (
    <SettingsForm
      key={me.data.id}
      initialProfile={me.data}
      catalogSkills={skillsQuery.data ?? SKILLS}
      onCreateCustomSkill={(input) => createCustomSkill.mutateAsync(input)}
      isCreatingCustom={createCustomSkill.isPending}
      onUploadPhoto={(asset) => uploadPhoto.mutateAsync(asset)}
      onRemovePhoto={() => removePhoto.mutateAsync()}
      isPhotoSaving={uploadPhoto.isPending || removePhoto.isPending}
      onSave={updateProfile.mutateAsync}
      isSaving={updateProfile.isPending}
    />
  );
}

function SettingsForm({
  initialProfile,
  catalogSkills,
  onCreateCustomSkill,
  isCreatingCustom,
  onUploadPhoto,
  onRemovePhoto,
  isPhotoSaving,
  onSave,
  isSaving,
}: {
  initialProfile: Profile;
  catalogSkills: typeof SKILLS;
  onCreateCustomSkill: ReturnType<typeof useCreateCustomSkill>['mutateAsync'];
  isCreatingCustom: boolean;
  onUploadPhoto: (asset: ProfilePhotoAssetInput) => Promise<string>;
  onRemovePhoto: () => Promise<void>;
  isPhotoSaving: boolean;
  onSave: ReturnType<typeof useUpdateProfile>['mutateAsync'];
  isSaving: boolean;
}) {
  const { colors, mode, setMode, accentId, setAccentId } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { resetToNewOnboarding, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [bio, setBio] = useState(initialProfile.bio);
  const [offers, setOffers] = useState<ID[]>(
    initialProfile.skills.filter((s) => s.kind === 'offers').map((s) => s.skillId),
  );
  const [wants, setWants] = useState<ID[]>(
    initialProfile.skills.filter((s) => s.kind === 'wants').map((s) => s.skillId),
  );
  const [error, setError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSavedBanner(false);
    if (displayName.trim().length < 2) {
      setError(t('settingsErrName'));
      return;
    }
    if (offers.length === 0 || wants.length === 0) {
      setError(t('settingsErrSkills'));
      return;
    }

    const existingLevels = new Map(
      initialProfile.skills.filter((s) => s.kind === 'offers').map((s) => [s.skillId, s.level]),
    );
    const skills: UserSkill[] = [
      ...offers.map((skillId) => ({
        skillId,
        kind: 'offers' as const,
        level: existingLevels.get(skillId) ?? ('advanced' as const),
      })),
      ...wants.map((skillId) => ({ skillId, kind: 'wants' as const })),
    ];

    try {
      await onSave({
        displayName: displayName.trim(),
        neighborhoodId: initialProfile.neighborhoodId,
        bio: bio.trim(),
        availabilitySummary: initialProfile.availabilitySummary,
        skills,
      });
      setSavedBanner(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorDefault'));
    }
  };

  const themeOptions: { id: ThemeMode; label: string; icon: 'sunny-outline' | 'moon-outline' | 'phone-portrait-outline' }[] = [
    { id: 'light', label: t('themeLight'), icon: 'sunny-outline' },
    { id: 'dark', label: t('themeDark'), icon: 'moon-outline' },
    { id: 'system', label: t('themeSystem'), icon: 'phone-portrait-outline' },
  ];

  const accentLabels: Record<AccentId, string> = {
    teal: t('accentTeal'),
    indigo: t('accentIndigo'),
    terracotta: t('accentTerracotta'),
    emerald: t('accentEmerald'),
  };

  const neighborhoodName = getNeighborhood(initialProfile.neighborhoodId)?.name ?? t('communityPrefix');

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <FadeInView style={{ gap: 4 }}>
        <Text variant="title">{t('settingsTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('settingsSubtitle')}
        </Text>
      </FadeInView>

      {/* 1. Profile photo section */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('settingsPhotoTitle')} subtitle={t('settingsPhotoSubtitle')} />
        <ProfilePhotoPicker
          displayName={displayName || initialProfile.displayName}
          currentUri={initialProfile.avatarUrl}
          isSaving={isPhotoSaving}
          onSaveAsset={onUploadPhoto}
          onRemovePhoto={onRemovePhoto}
        />
      </Card>

      {/* 2. Personal info */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('settingsPersonalTitle')} />
        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('settingsDisplayNameLabel')}
          </Text>
          <TextInput
            value={displayName}
            onChangeText={(txt) => {
              setSavedBanner(false);
              setDisplayName(txt);
            }}
            placeholder={t('settingsDisplayNamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              minHeight: 46,
              fontSize: 16,
              color: colors.text,
            }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('settingsNeighborhoodLabel')}
          </Text>
          <Badge label={neighborhoodName} fg={colors.primary} bg={colors.primarySoft} icon="location-outline" />
          <Text variant="caption" color={colors.textMuted}>
            {t('settingsNeighborhoodNote', { name: neighborhoodName })}
          </Text>
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('settingsBioLabel')}
          </Text>
          <TextInput
            value={bio}
            onChangeText={(txt) => {
              setSavedBanner(false);
              setBio(txt);
            }}
            placeholder={t('settingsBioPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              minHeight: 84,
              fontSize: 15,
              color: colors.text,
              textAlignVertical: 'top',
            }}
          />
        </View>
      </Card>

      {/* 3. Teach & Learn Skills */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('settingsTeachTitle')} subtitle={t('settingsTeachSubtitle')} />
        <SkillCatalogPicker
          mode="multi"
          skills={catalogSkills}
          selectedIds={offers}
          onChange={(next) => {
            setSavedBanner(false);
            setOffers(next);
          }}
          tone={colors.primary}
          allowCustomCreate
          isCreatingCustom={isCreatingCustom}
          onCreateCustomSkill={onCreateCustomSkill}
        />

        <View style={{ paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.md }}>
          <SectionHeader title={t('settingsLearnTitle')} subtitle={t('settingsLearnSubtitle')} />
          <SkillCatalogPicker
            mode="multi"
            skills={catalogSkills}
            selectedIds={wants}
            onChange={(next) => {
              setSavedBanner(false);
              setWants(next);
            }}
            tone={colors.accent}
            allowCustomCreate
            isCreatingCustom={isCreatingCustom}
            onCreateCustomSkill={onCreateCustomSkill}
          />
        </View>

        {error ? (
          <Text variant="caption" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        {savedBanner ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingTop: spacing.xs,
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text variant="caption" color={colors.success} style={{ fontWeight: '600' }}>
              {t('settingsSavedSuccess')}
            </Text>
          </View>
        ) : null}

        <Button
          title={t('settingsSaveProfileBtn')}
          icon="save-outline"
          loading={isSaving}
          fullWidth
          onPress={handleSave}
        />
      </Card>

      {/* 4. Availability Schedule */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader
          title={t('settingsAvailabilityTitle')}
          subtitle={t('settingsAvailabilitySubtitle', { summary: initialProfile.availabilitySummary })}
        />
        <Button
          title={t('settingsAvailabilityBtn')}
          variant="secondary"
          icon="calendar-outline"
          fullWidth
          onPress={() => router.push('/availability')}
        />
      </Card>

      {/* 5. Appearance & Language (Live Persisted) */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('settingsAppearanceTitle')} subtitle={t('settingsAppearanceSubtitle')} />

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            {t('languageLabel').toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip
              label={t('localeEsAr')}
              icon="language-outline"
              selected={locale === 'es-AR'}
              onPress={() => setLocale('es-AR')}
            />
            <Chip
              label={t('localeEn')}
              icon="language-outline"
              selected={locale === 'en'}
              onPress={() => setLocale('en')}
            />
          </View>
        </View>

        <View style={{ gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text variant="label" color={colors.textMuted}>
            {t('themeModeLabel').toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {themeOptions.map((opt) => (
              <Chip
                key={opt.id}
                label={opt.label}
                icon={opt.icon}
                selected={mode === opt.id}
                onPress={() => setMode(opt.id)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text variant="label" color={colors.textMuted}>
            {t('accentPaletteLabel').toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {ACCENT_IDS.map((id) => {
              const selected = accentId === id;
              const swatch = ACCENT_PALETTES[id].swatch;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setAccentId(id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 7,
                    borderRadius: radius.pill,
                    borderWidth: 1.5,
                    borderColor: selected ? swatch : colors.border,
                    backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                  }}
                >
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: swatch,
                    }}
                  />
                  <Text variant="caption" style={{ fontWeight: selected ? '700' : '600' }}>
                    {accentLabels[id]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      {/* 6. Account & Diagnostics */}
      <Card variant="tinted" style={{ gap: spacing.sm }}>
        <SectionHeader title={t('settingsAccountTitle')} subtitle={t('settingsAccountSubtitle')} />
        <Button
          title={t('settingsDiagnosticsBtn')}
          variant="secondary"
          icon="pulse-outline"
          fullWidth
          onPress={() => router.push('/dev')}
        />
        <Button
          title={t('settingsOnboardingTestBtn')}
          variant="secondary"
          icon="sparkles-outline"
          fullWidth
          onPress={() => {
            resetToNewOnboarding();
            router.push('/(onboarding)/eligibility');
          }}
        />
        <Button
          title={t('settingsSignOutBtn')}
          variant="ghost"
          icon="log-out-outline"
          fullWidth
          onPress={() => {
            signOut();
            router.replace('/welcome');
          }}
        />
      </Card>
    </Screen>
  );
}
