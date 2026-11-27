/**
 * Pure theme tokens with zero react-native imports so Node tests can validate
 * light/dark palettes and accent presets cleanly.
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';
export type AccentId = 'teal' | 'indigo' | 'terracotta' | 'emerald';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;

  primary: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;

  credit: string;
  creditSoft: string;
  creditBorder: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  info: string;
  infoSoft: string;
  star: string;
}

export const lightBaseColors = {
  bg: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EEE6',
  border: '#E7E0D5',
  text: '#1C1917',
  textMuted: '#6B635A',
  textInverse: '#FFFFFF',

  credit: '#B45309',
  creditSoft: '#FEF3C7',
  creditBorder: '#FDE68A',
  success: '#15803D',
  successSoft: '#DCFCE7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  warning: '#A16207',
  warningSoft: '#FEF9C3',
  warningBorder: '#FDE68A',
  info: '#1D4ED8',
  infoSoft: '#DBEAFE',
  star: '#F59E0B',
} as const;

export const darkBaseColors = {
  bg: '#111315',
  surface: '#1A1D21',
  surfaceAlt: '#24282E',
  border: '#323740',
  text: '#F5F5F4',
  textMuted: '#A8A29E',
  textInverse: '#111315',

  credit: '#FBBF24',
  creditSoft: '#451A03',
  creditBorder: '#78350F',
  success: '#4ADE80',
  successSoft: '#052E16',
  danger: '#F87171',
  dangerSoft: '#450A0A',
  warning: '#FACC15',
  warningSoft: '#422006',
  warningBorder: '#713F12',
  info: '#60A5FA',
  infoSoft: '#172554',
  star: '#FBBF24',
} as const;

interface AccentPair {
  primary: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
}

export const ACCENT_PALETTES: Record<AccentId, { light: AccentPair; dark: AccentPair; swatch: string }> = {
  teal: {
    swatch: '#0F766E',
    light: {
      primary: '#0F766E',
      primarySoft: '#CCFBF1',
      onPrimary: '#FFFFFF',
      accent: '#C2410C',
      accentSoft: '#FFEDD5',
    },
    dark: {
      primary: '#2DD4BF',
      primarySoft: '#134E4A',
      onPrimary: '#042F2E',
      accent: '#FB923C',
      accentSoft: '#431407',
    },
  },
  indigo: {
    swatch: '#4338CA',
    light: {
      primary: '#4338CA',
      primarySoft: '#E0E7FF',
      onPrimary: '#FFFFFF',
      accent: '#0F766E',
      accentSoft: '#CCFBF1',
    },
    dark: {
      primary: '#818CF8',
      primarySoft: '#312E81',
      onPrimary: '#1E1B4B',
      accent: '#2DD4BF',
      accentSoft: '#134E4A',
    },
  },
  terracotta: {
    swatch: '#C2410C',
    light: {
      primary: '#C2410C',
      primarySoft: '#FFEDD5',
      onPrimary: '#FFFFFF',
      accent: '#0F766E',
      accentSoft: '#CCFBF1',
    },
    dark: {
      primary: '#FB923C',
      primarySoft: '#431407',
      onPrimary: '#431407',
      accent: '#2DD4BF',
      accentSoft: '#134E4A',
    },
  },
  emerald: {
    swatch: '#047857',
    light: {
      primary: '#047857',
      primarySoft: '#D1FAE5',
      onPrimary: '#FFFFFF',
      accent: '#B45309',
      accentSoft: '#FEF3C7',
    },
    dark: {
      primary: '#34D399',
      primarySoft: '#064E3B',
      onPrimary: '#022C22',
      accent: '#FBBF24',
      accentSoft: '#451A03',
    },
  },
};

export const ACCENT_IDS: readonly AccentId[] = ['teal', 'indigo', 'terracotta', 'emerald'];

function parseHexRgb(hex: string): [number, number, number] | null {
  const trimmed = hex.trim();
  const match6 = /^#([0-9A-Fa-f]{6})$/.exec(trimmed);
  if (match6) {
    const value = parseInt(match6[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  const match3 = /^#([0-9A-Fa-f]{3})$/.exec(trimmed);
  if (match3) {
    const s = match3[1];
    return [
      parseInt(s[0] + s[0], 16),
      parseInt(s[1] + s[1], 16),
      parseInt(s[2] + s[2], 16),
    ];
  }
  return null;
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function getContrastRatio(hexA: string, hexB: string): number | null {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  if (lumA === null || lumB === null) return null;
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastTextColor(bgHex: string): string {
  const lum = getRelativeLuminance(bgHex);
  if (lum === null) return '#FFFFFF';
  const contrastWithWhite = 1.05 / (lum + 0.05);
  const darkLum = getRelativeLuminance('#111315')!;
  const contrastWithDark = (Math.max(lum, darkLum) + 0.05) / (Math.min(lum, darkLum) + 0.05);
  return contrastWithWhite >= contrastWithDark ? '#FFFFFF' : '#111315';
}

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function isAccentId(value: string | null | undefined): value is AccentId {
  return value === 'teal' || value === 'indigo' || value === 'terracotta' || value === 'emerald';
}

export function resolveThemeMode(mode: ThemeMode, systemScheme?: 'light' | 'dark' | null): ResolvedScheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function resolveThemeColors(scheme: ResolvedScheme, accentId: AccentId = 'teal'): ThemeColors {
  const base = scheme === 'dark' ? darkBaseColors : lightBaseColors;
  const palette = (ACCENT_PALETTES[accentId] ?? ACCENT_PALETTES.teal)[scheme];
  return {
    ...base,
    ...palette,
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '800' as const, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '700' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700' as const, lineHeight: 16, letterSpacing: 0.4 },
} as const;

export type TypographyVariant = keyof typeof typography;

export function getCardShadow(scheme: ResolvedScheme) {
  if (scheme === 'dark') {
    return {
      shadowColor: '#000000',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    } as const;
  }
  return {
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  } as const;
}
