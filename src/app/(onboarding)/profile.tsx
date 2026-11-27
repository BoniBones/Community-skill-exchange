import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { ProfilePhotoPicker } from '../../components/ProfilePhotoPicker';
import { getNeighborhood } from '../../domain/catalog';
import { useAuth } from '../../features/auth/authContext';
import { useI18n } from '../../lib/i18n';
import { useCurrentUserId, useRemoveProfilePhoto, useUploadProfilePhoto } from '../../services/queries';
import { DemoBanner, Screen, SectionHeader } from '../../ui/layout';
import { Badge, Button, Card, Text } from '../../ui/primitives';
import { radius, spacing, useTheme } from '../../ui/theme';

export default function OnboardingProfileScreen() {
  const { draft, updateDraft } = useAuth();
  const { data: userId } = useCurrentUserId();
  const uploadPhoto = useUploadProfilePhoto(userId);
  const removePhoto = useRemoveProfilePhoto(userId);
  const { colors } = useTheme();
  const { t } = useI18n();

  const [displayName, setDisplayName] = useState(draft.displayName);
  const [bio, setBio] = useState(draft.bio);
  const [availabilitySummary, setAvailabilitySummary] = useState(draft.availabilitySummary);
  const [error, setError] = useState<string | null>(null);

  if (!draft.neighborhoodVerifiedAt) {
    return <Redirect href="/(onboarding)/neighborhood" />;
  }

  const verifiedNeighborhoodName = getNeighborhood(draft.neighborhoodId)?.name ?? 'Santo Tomás';

  const handleNext = () => {
    setError(null);
    if (displayName.trim().length < 2) {
      setError(t('onbProfErrName'));
      return;
    }
    if (bio.trim().length < 10) {
      setError(t('onbProfErrBio'));
      return;
    }
    updateDraft({
      displayName: displayName.trim(),
      bio: bio.trim(),
      availabilitySummary: availabilitySummary.trim() || t('commonToCoordinate'),
    });
    router.push('/(onboarding)/skills');
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge label={t('onbProfStepBadge')} fg={colors.primary} bg={colors.primarySoft} icon="person-outline" />
        <Text variant="title">{t('onbProfTitle')}</Text>
        <Text color={colors.textMuted}>{t('onbProfSubtitle')}</Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('settingsPhotoTitle')} subtitle={t('settingsPhotoSubtitle')} />
        <ProfilePhotoPicker
          displayName={displayName || draft.displayName}
          currentUri={draft.avatarUrl}
          isSaving={uploadPhoto.isPending || removePhoto.isPending}
          onSaveAsset={async (asset) => {
            const uri = await uploadPhoto.mutateAsync(asset);
            updateDraft({ avatarUrl: uri });
            return uri;
          }}
          onRemovePhoto={async () => {
            await removePhoto.mutateAsync();
            updateDraft({ avatarUrl: undefined });
          }}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('onbProfNameLabel')}
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('onbProfNamePlaceholder')}
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

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            {t('onbProfZoneLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <Badge
              label={t('onbProfVerifiedZoneBadge', { name: verifiedNeighborhoodName })}
              fg={colors.success}
              bg={colors.successSoft}
              icon="shield-checkmark-outline"
            />
            <Button
              title={t('onbProfChangeZoneBtn')}
              variant="ghost"
              onPress={() => router.replace('/(onboarding)/neighborhood')}
            />
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('onbProfBioLabel')}
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder={t('onbProfBioPlaceholder')}
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
              minHeight: 90,
              fontSize: 15,
              color: colors.text,
              textAlignVertical: 'top',
            }}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('onbProfAvailLabel')}
          </Text>
          <TextInput
            value={availabilitySummary}
            onChangeText={setAvailabilitySummary}
            placeholder={t('onbProfAvailPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              minHeight: 46,
              fontSize: 15,
              color: colors.text,
            }}
          />
        </View>
      </Card>

      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <Button title={t('onbProfContinue')} icon="arrow-forward-outline" fullWidth onPress={handleNext} />
    </Screen>
  );
}
