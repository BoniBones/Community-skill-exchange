import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { View } from 'react-native';

import type { ProfilePhotoAssetInput } from '../domain/types';
import { useI18n } from '../lib/i18n';
import { validateProfilePhotoAsset } from '../lib/profilePhoto';
import { Avatar, Badge, Button, Text } from '../ui/primitives';
import { animateLayout, radius, spacing, useTheme } from '../ui/theme';

interface ProfilePhotoPickerProps {
  displayName: string;
  currentUri?: string;
  onSaveAsset: (asset: ProfilePhotoAssetInput) => Promise<string>;
  onRemovePhoto?: () => Promise<void>;
  isSaving?: boolean;
}

export function ProfilePhotoPicker({
  displayName,
  currentUri,
  onSaveAsset,
  onRemovePhoto,
  isSaving = false,
}: ProfilePhotoPickerProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [pendingAsset, setPendingAsset] = useState<ProfilePhotoAssetInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const previewUri = pendingAsset?.uri ?? currentUri;
  const loading = busy || isSaving;

  const handlePickedResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]) return;
    const picked = result.assets[0];
    const candidate: ProfilePhotoAssetInput = {
      uri: picked.uri,
      mimeType: picked.mimeType ?? null,
      fileSize: picked.fileSize ?? null,
      fileName: picked.fileName ?? null,
    };
    const validation = validateProfilePhotoAsset(candidate);
    if (!validation.valid) {
      setError(t(validation.errorKey));
      setStatusMsg(null);
      return;
    }
    setError(null);
    setStatusMsg(null);
    animateLayout();
    setPendingAsset(candidate);
  };

  const handlePickGallery = async () => {
    setError(null);
    setStatusMsg(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(t('photoPickerPermDenied'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      handlePickedResult(result);
    } catch {
      setError(t('photoPickerPickErr'));
    }
  };

  const handleTakePhoto = async () => {
    setError(null);
    setStatusMsg(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError(t('photoPickerCameraDenied'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      handlePickedResult(result);
    } catch {
      setError(t('photoPickerPickErr'));
    }
  };

  const handleSavePreview = async () => {
    if (!pendingAsset) return;
    setError(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      await onSaveAsset(pendingAsset);
      animateLayout();
      setPendingAsset(null);
      setStatusMsg(t('photoPickerSavedMsg'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorDefault'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemovePhoto) return;
    setError(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      await onRemovePhoto();
      animateLayout();
      setPendingAsset(null);
      setStatusMsg(t('photoPickerRemovedMsg'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorDefault'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name={displayName} uri={previewUri} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          {pendingAsset ? (
            <>
              <Badge
                label={t('photoPickerPreviewBadge')}
                fg={colors.warning}
                bg={colors.warningSoft}
                icon="eye-outline"
              />
              <Text variant="caption" color={colors.textMuted}>
                {t('photoPickerPreviewHint')}
              </Text>
            </>
          ) : (
            <Text variant="caption" color={colors.textMuted}>
              {currentUri ? t('settingsPhotoSubtitle') : t('photoPickerEmptyHint')}
            </Text>
          )}
        </View>
      </View>

      {pendingAsset ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title={loading ? t('photoPickerSavingLabel') : t('photoPickerSaveBtn')}
            icon="checkmark-circle-outline"
            loading={loading}
            style={{ flex: 1 }}
            onPress={handleSavePreview}
          />
          <Button
            title={t('photoPickerCancelBtn')}
            variant="secondary"
            disabled={loading}
            onPress={() => {
              animateLayout();
              setPendingAsset(null);
              setError(null);
            }}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button
            title={currentUri ? t('photoPickerReplaceBtn') : t('photoPickerGalleryBtn')}
            variant="secondary"
            icon="images-outline"
            disabled={loading}
            onPress={handlePickGallery}
          />
          <Button
            title={t('photoPickerCameraBtn')}
            variant="secondary"
            icon="camera-outline"
            disabled={loading}
            onPress={handleTakePhoto}
          />
          {currentUri && onRemovePhoto ? (
            <Button
              title={t('photoPickerRemoveBtn')}
              variant="danger"
              icon="trash-outline"
              loading={loading}
              onPress={handleRemove}
            />
          ) : null}
        </View>
      )}

      {error ? (
        <View
          style={{
            padding: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: colors.dangerSoft,
            borderWidth: 1,
            borderColor: colors.danger,
          }}
        >
          <Text variant="caption" color={colors.danger} style={{ fontWeight: '600' }}>
            {error}
          </Text>
        </View>
      ) : null}

      {statusMsg ? (
        <Text variant="caption" color={colors.success} style={{ fontWeight: '600' }}>
          {statusMsg}
        </Text>
      ) : null}
    </View>
  );
}
