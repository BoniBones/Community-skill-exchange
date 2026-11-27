/**
 * Supabase client (public, client-side). Created lazily and only when
 * EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.
 *
 * SECURITY: only the publishable/anon key belongs in the app. The service-role key
 * must never be bundled; it lives in Edge Function secrets only.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { CategoryId, ProfilePhotoAssetInput } from '../domain/types';
import { config } from '../lib/config';
import { t } from '../lib/i18n';
import { validateProfilePhotoAsset } from '../lib/profilePhoto';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!config.isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        // AsyncStorage isn't available during web static rendering; supabase-js falls back to memory.
        storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export interface BackendHealth {
  status: 'not_configured' | 'ok' | 'error';
  latencyMs?: number;
  detail: string;
}

/**
 * Connectivity check from the phone to the Supabase project. It calls the public
 * Auth health endpoint with the anon key; no user data is read.
 */
export async function checkBackendHealth(): Promise<BackendHealth> {
  if (!config.isSupabaseConfigured) {
    return { status: 'not_configured', detail: t('sbMissingEnv') };
  }
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/health`, {
      headers: { apikey: config.supabaseAnonKey },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - started;
    return res.ok
      ? { status: 'ok', latencyMs, detail: t('sbConnectedDetail', { status: res.status }) }
      : { status: 'error', latencyMs, detail: t('sbHttpErrorDetail', { status: res.status }) };
  } catch (e) {
    return {
      status: 'error',
      detail: t('sbNetworkErrorDetail', { message: e instanceof Error ? e.message : String(e) }),
    };
  }
}

export const AVATARS_BUCKET = 'avatars';

export function buildAvatarStoragePath(userId: string, extension: string): string {
  return `${userId}/avatar-${Date.now()}.${extension}`;
}

export async function uploadAvatarToSupabase(
  userId: string,
  asset: ProfilePhotoAssetInput,
): Promise<string> {
  const validation = validateProfilePhotoAsset(asset);
  if (!validation.valid) {
    throw new Error(t(validation.errorKey));
  }
  const sb = getSupabase();
  if (!sb) {
    throw new Error(t('sbMissingEnv'));
  }

  const path = buildAvatarStoragePath(userId, validation.extension);
  const response = await fetch(asset.uri);
  const body = await response.arrayBuffer();
  const contentType = asset.mimeType?.trim() || `image/${validation.extension === 'jpg' ? 'jpeg' : validation.extension}`;

  const { error: uploadError } = await sb.storage
    .from(AVATARS_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = sb.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function removeAvatarFromSupabase(path: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(t('sbMissingEnv'));
  }
  const { error } = await sb.storage.from(AVATARS_BUCKET).remove([path]);
  if (error) {
    throw new Error(error.message);
  }
}

export async function verifyNeighborhoodAccessRpc(neighborhoodId: string, accessCode: string) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(t('sbMissingEnv'));
  }
  const { data, error } = await sb.rpc('verify_neighborhood_access', {
    p_neighborhood_id: neighborhoodId,
    p_access_code: accessCode,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function createCustomSkillRpc(name: string, categoryId: CategoryId, description?: string) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(t('sbMissingEnv'));
  }
  const { data, error } = await sb.rpc('create_custom_skill', {
    p_name: name,
    p_category_id: categoryId,
    p_description: description ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data;
}
