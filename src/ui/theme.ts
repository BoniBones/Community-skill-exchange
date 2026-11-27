import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { getStoredItem, setStoredItem } from '../lib/storage';
import {
  getCardShadow,
  isAccentId,
  isThemeMode,
  resolveThemeColors,
  resolveThemeMode,
  type AccentId,
  type ResolvedScheme,
  type ThemeColors,
  type ThemeMode,
} from './themeTokens';

export * from './themeTokens';

const THEME_MODE_KEY = 'cse.themeMode';
const ACCENT_ID_KEY = 'cse.accentId';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedScheme: ResolvedScheme;
  accentId: AccentId;
  setAccentId: (accentId: AccentId) => void;
  colors: ThemeColors;
  shadow: ReturnType<typeof getCardShadow>;
}

const defaultColors = resolveThemeColors('light', 'teal');
const defaultShadow = getCardShadow('light');

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  setMode: () => {},
  resolvedScheme: 'light',
  accentId: 'teal',
  setAccentId: () => {},
  colors: defaultColors,
  shadow: defaultShadow,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [accentId, setAccentIdState] = useState<AccentId>('teal');

  useEffect(() => {
    let active = true;
    void (async () => {
      const [storedMode, storedAccent] = await Promise.all([
        getStoredItem(THEME_MODE_KEY),
        getStoredItem(ACCENT_ID_KEY),
      ]);
      if (!active) return;
      if (isThemeMode(storedMode)) setModeState(storedMode);
      if (isAccentId(storedAccent)) setAccentIdState(storedAccent);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void setStoredItem(THEME_MODE_KEY, next);
  };

  const setAccentId = (next: AccentId) => {
    setAccentIdState(next);
    void setStoredItem(ACCENT_ID_KEY, next);
  };

  const resolvedScheme = resolveThemeMode(mode, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      resolvedScheme,
      accentId,
      setAccentId,
      colors: resolveThemeColors(resolvedScheme, accentId),
      shadow: getCardShadow(resolvedScheme),
    }),
    [mode, resolvedScheme, accentId],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/* ─────────────── Subtle Expo Go-Compatible Animations ─────────────── */

let androidLayoutAnimInitialized = false;

export function animateLayout(): void {
  try {
    if (Platform.OS === 'android' && !androidLayoutAnimInitialized) {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
      androidLayoutAnimInitialized = true;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  } catch {
    // Ignore in unsupported environments
  }
}

export function useFadeSlideIn(delayMs = 0) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(8));

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        delay: delayMs,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        delay: delayMs,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delayMs, opacity, translateY]);

  return { opacity, transform: [{ translateY }] };
}

export function FadeInView({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const animStyle = useFadeSlideIn(delay);
  return createElement(Animated.View, { style: [animStyle, style] }, children);
}
