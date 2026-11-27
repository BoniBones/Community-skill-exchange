/**
 * Pure TypeScript profile photo validation helpers. Zero React Native imports so
 * both the Expo Go UI picker and Node.js unit tests share exact validation rules.
 */
import type { ProfilePhotoAssetInput } from '../domain/types';

export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ALLOWED_URI_PREFIXES = [
  'file://',
  'content://',
  'ph://',
  'assets-library://',
  'https://',
  'http://',
  'data:image/',
];

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const EXT_REGEX = /\.(jpe?g|png|webp|heic|heif)(\?.*)?$/i;
const DATA_URL_MIME_REGEX = /^data:(image\/[a-z0-9.+-]+);/i;

function extractExtension(raw?: string | null): string | null {
  const clean = raw?.trim().split('#')[0] ?? '';
  const match = EXT_REGEX.exec(clean);
  if (!match?.[1]) return null;
  const rawExt = match[1].toLowerCase();
  return rawExt === 'jpeg' ? 'jpg' : rawExt;
}

export type ProfilePhotoValidationErrorKey =
  | 'errPhotoInvalidUri'
  | 'errPhotoInvalidType'
  | 'errPhotoTooLarge';

export type ProfilePhotoValidationResult =
  | { valid: true; extension: string }
  | { valid: false; errorKey: ProfilePhotoValidationErrorKey };

export function validateProfilePhotoAsset(asset: ProfilePhotoAssetInput): ProfilePhotoValidationResult {
  const uri = asset.uri?.trim() ?? '';
  if (!uri || !ALLOWED_URI_PREFIXES.some((prefix) => uri.toLowerCase().startsWith(prefix))) {
    return { valid: false, errorKey: 'errPhotoInvalidUri' };
  }

  let extension: string | null = null;
  const normalizedMime = asset.mimeType?.trim().toLowerCase();

  if (normalizedMime) {
    if (!ALLOWED_PHOTO_MIME_TYPES.has(normalizedMime)) {
      return { valid: false, errorKey: 'errPhotoInvalidType' };
    }
    extension = MIME_TO_EXT[normalizedMime] ?? 'jpg';
  } else if (uri.toLowerCase().startsWith('data:image/')) {
    const match = DATA_URL_MIME_REGEX.exec(uri);
    const dataMime = match?.[1]?.toLowerCase();
    if (!dataMime || !ALLOWED_PHOTO_MIME_TYPES.has(dataMime)) {
      return { valid: false, errorKey: 'errPhotoInvalidType' };
    }
    extension = MIME_TO_EXT[dataMime] ?? 'jpg';
  } else {
    const rawExt = extractExtension(asset.fileName) ?? extractExtension(uri);
    if (!rawExt) {
      return { valid: false, errorKey: 'errPhotoInvalidType' };
    }
    extension = rawExt;
  }

  if (typeof asset.fileSize === 'number') {
    if (!Number.isFinite(asset.fileSize) || asset.fileSize <= 0 || asset.fileSize > MAX_PROFILE_PHOTO_BYTES) {
      return { valid: false, errorKey: 'errPhotoTooLarge' };
    }
  }

  return { valid: true, extension };
}
