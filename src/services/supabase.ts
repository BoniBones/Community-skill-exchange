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

import { config } from '../lib/config';

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
    return { status: 'not_configured', detail: 'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY en .env' };
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
      ? { status: 'ok', latencyMs, detail: `Conectado (HTTP ${res.status})` }
      : { status: 'error', latencyMs, detail: `Respuesta HTTP ${res.status}. Revisá la URL y la clave.` };
  } catch (e) {
    return { status: 'error', detail: `Sin conexión: ${e instanceof Error ? e.message : String(e)}` };
  }
}
