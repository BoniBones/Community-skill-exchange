import { useEffect, useState } from 'react';

export type SupportedLocale = 'es-AR' | 'en';

const dictionaries = {
  'es-AR': {
    appName: 'Community Skill Exchange',
    communityTagline: 'Todos tenemos algo para enseñar y algo para aprender.',
    communityMission:
      'Enseñá una hora para sumar un crédito comunitario, o combiná créditos y dinero según lo que defina cada instructor.',
    homeGreeting: 'Hola',
    communityPrefix: 'Comunidad',
    missionBadge: 'FILOSOFÍA COMUNITARIA',
    nextSessionTitle: 'Tu próxima sesión',
    nextSessionSubtitle: 'Recordá verificar asistencia con código QR al empezar y terminar',
    reciprocalTitle: 'Coincidencias recíprocas',
    reciprocalSubtitle: 'Vecinos que enseñan lo que buscás y quieren aprender lo que vos ofrecés',
    categoriesTitle: 'Explorar por categoría',
    categoriesSubtitle: 'Tocá una categoría para filtrar actividades',
    recommendedTitle: 'Recomendadas para vos',
    recommendedSubtitle: 'Según tus intereses, cercanía y participación en la comunidad',
    seeAll: 'Ver todas',
    languageLabel: 'Idioma de la interfaz',
    localeEsAr: 'Español (Argentina)',
    localeEn: 'English',
  },
  en: {
    appName: 'Community Skill Exchange',
    communityTagline: 'Everyone has something they can teach, and everyone has something they can learn.',
    communityMission:
      'Teach for one hour to earn one community credit, or combine credits and money as configured by each instructor.',
    homeGreeting: 'Hello',
    communityPrefix: 'Community',
    missionBadge: 'COMMUNITY PHILOSOPHY',
    nextSessionTitle: 'Your next session',
    nextSessionSubtitle: 'Remember to verify attendance with dynamic QR at start and finish',
    reciprocalTitle: 'Reciprocal matches',
    reciprocalSubtitle: 'Neighbors who teach what you want to learn and want to learn what you offer',
    categoriesTitle: 'Explore by category',
    categoriesSubtitle: 'Tap a category to filter community activities',
    recommendedTitle: 'Recommended for you',
    recommendedSubtitle: 'Based on your interests, neighborhood proximity, and community participation',
    seeAll: 'See all',
    languageLabel: 'Interface language',
    localeEsAr: 'Español (Argentina)',
    localeEn: 'English',
  },
} as const;

export type TranslationKey = keyof (typeof dictionaries)['es-AR'];

export function getDeviceLocaleCode(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'es-AR';
  } catch {
    return 'es-AR';
  }
}

let activeLocale: SupportedLocale = 'es-AR';
const listeners = new Set<(locale: SupportedLocale) => void>();

export function getActiveLocale(): SupportedLocale {
  return activeLocale;
}

export function setActiveLocale(next: SupportedLocale): void {
  activeLocale = next;
  listeners.forEach((listener) => listener(next));
}

export function t(key: TranslationKey, locale: SupportedLocale = activeLocale): string {
  return dictionaries[locale][key] ?? dictionaries['es-AR'][key];
}

export function useI18n() {
  const [locale, setLocaleState] = useState<SupportedLocale>(activeLocale);

  useEffect(() => {
    const listener = (next: SupportedLocale) => setLocaleState(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    locale,
    setLocale: setActiveLocale,
    t: (key: TranslationKey) => t(key, locale),
  };
}
