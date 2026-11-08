/**
 * Public runtime configuration. Only EXPO_PUBLIC_* variables are inlined into the
 * JS bundle, so NEVER put secrets (e.g. the Supabase service-role key) here.
 */
export type DataMode = 'mock' | 'supabase';

const rawMode = process.env.EXPO_PUBLIC_DATA_MODE;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const config = {
  /** Defaults to mock mode until a Supabase project is configured (Stage 3). */
  dataMode: (rawMode === 'supabase' ? 'supabase' : 'mock') as DataMode,
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured: supabaseUrl.length > 0 && supabaseAnonKey.length > 0,
  timeZone: 'America/Argentina/Buenos_Aires',
  locale: 'es-AR',
} as const;
