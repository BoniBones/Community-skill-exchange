/**
 * Design tokens. Warm, community-oriented palette:
 *  - primary (teal)   → learning / main actions
 *  - accent (terracotta) → community / people
 *  - credit (amber)   → community credits
 *  - money (green)    → monetary amounts
 */
export const colors = {
  bg: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EEE6',
  border: '#E7E0D5',
  text: '#1C1917',
  textMuted: '#6B635A',
  textInverse: '#FFFFFF',

  primary: '#0F766E',
  primarySoft: '#CCFBF1',
  accent: '#C2410C',
  accentSoft: '#FFEDD5',
  credit: '#B45309',
  creditSoft: '#FEF3C7',
  money: '#15803D',
  moneySoft: '#DCFCE7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  warning: '#A16207',
  warningSoft: '#FEF9C3',
  info: '#1D4ED8',
  infoSoft: '#DBEAFE',
} as const;

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

export const shadow = {
  card: {
    shadowColor: '#1C1917',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
} as const;
