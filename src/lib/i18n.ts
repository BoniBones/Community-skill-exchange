import { useEffect, useState } from 'react';

export type SupportedLocale = 'es-AR' | 'en';

const dictionaries = {
  'es-AR': {
    appName: 'CSE',
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

    // Tabs
    tabCommunity: 'Comunidad',
    tabExplore: 'Explorar',
    tabSessions: 'Sesiones',
    tabWallet: 'Créditos',
    tabProfile: 'Mi perfil',

    // Explore
    exploreTitle: 'Explorar actividades',
    exploreSubtitle: 'Filtrá por habilidad, coincidencia recíproca, formato, barrio o modalidad de intercambio.',
    exploreSearchPlaceholder: 'Buscar habilidad, actividad o instructor…',
    exploreMatchFormatLabel: 'EMPAREJAMIENTO Y FORMATO',
    exploreReciprocalOnly: 'Solo intercambio mutuo',
    exploreInPerson: 'Presencial',
    exploreOnline: 'Online',
    explorePaymentLabel: 'MODALIDAD DE PAGO',
    exploreAll: 'Todas',

    // Sessions
    sessionsTitle: 'Mis sesiones',
    sessionsSubtitle: 'Coordiná horarios, confirmá solicitudes y verificá asistencia con QR en 2 etapas.',
    sessionsEmptyTitle: 'Todavía no tenés sesiones',
    sessionsEmptyMsg: 'Explorá actividades de tu comunidad para reservar tu primer encuentro.',

    // Wallet
    walletTitle: 'Billetera y economía',
    walletSubtitle: '1 hora enseñando = 1 crédito estándar. Créditos y dinero (ARS) en circuitos separados.',
    walletAvailable: 'SALDO DISPONIBLE',
    walletEscrow: 'En custodia (reservas)',
    walletIncoming: 'Por cobrar (a verificar)',
    walletLedgerTitle: 'Movimientos de créditos',

    // Profile
    profileCompletedSessions: 'Sesiones completadas',
    profileContributions: 'Aportes a la comunidad',
    profileEditBtn: 'Editar perfil y habilidades',
    profileOffers: 'PUEDO ENSEÑAR',
    profileWants: 'QUIERO APRENDER',
    profileMyActivities: 'Actividades que ofrezco',
    profileManage: 'Gestionar',
    profileReviews: 'Reseñas verificadas',
    profileMoreTitle: 'Comunidad, Moderación y Diagnóstico',
    profileNotificationsBtn: 'Notificaciones de la comunidad',
    profileAdminBtn: 'Panel de Moderación y Disputas',
    profileDiagnosticsBtn: 'Abrir diagnóstico técnico',
    profileSignOutBtn: 'Volver a pantalla de bienvenida',

    // Notifications
    notificationsTitle: 'Bandeja de la comunidad',
    notificationsSubtitle: 'Avisos de sesiones, liberación de créditos tras doble QR, reseñas y resoluciones',
    notificationsMarkRead: 'Marcar leídas',
    notificationsEmptyTitle: 'Sin notificaciones por ahora',
  },
  en: {
    appName: 'CSE',
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

    // Tabs
    tabCommunity: 'Community',
    tabExplore: 'Explore',
    tabSessions: 'Sessions',
    tabWallet: 'Credits',
    tabProfile: 'Profile',

    // Explore
    exploreTitle: 'Explore activities',
    exploreSubtitle: 'Filter by skill, reciprocal match, format, neighborhood, or payment arrangement.',
    exploreSearchPlaceholder: 'Search skill, activity, or instructor…',
    exploreMatchFormatLabel: 'MATCHING & FORMAT',
    exploreReciprocalOnly: 'Reciprocal match only',
    exploreInPerson: 'In person',
    exploreOnline: 'Online',
    explorePaymentLabel: 'PAYMENT ARRANGEMENT',
    exploreAll: 'All',

    // Sessions
    sessionsTitle: 'My sessions',
    sessionsSubtitle: 'Coordinate schedules, confirm requests, and verify attendance with 2-stage QR.',
    sessionsEmptyTitle: 'No sessions yet',
    sessionsEmptyMsg: 'Explore community activities to book your first session.',

    // Wallet
    walletTitle: 'Wallet & economy',
    walletSubtitle: '1 hour teaching = 1 standard credit. Credits and money (ARS) in separate ledgers.',
    walletAvailable: 'AVAILABLE BALANCE',
    walletEscrow: 'Held in escrow',
    walletIncoming: 'Incoming (pending QR)',
    walletLedgerTitle: 'Credit ledger',

    // Profile
    profileCompletedSessions: 'Completed sessions',
    profileContributions: 'Community contributions',
    profileEditBtn: 'Edit profile & skills',
    profileOffers: 'CAN TEACH',
    profileWants: 'WANT TO LEARN',
    profileMyActivities: 'Activities I offer',
    profileManage: 'Manage',
    profileReviews: 'Verified reviews',
    profileMoreTitle: 'Community, Moderation & Diagnostics',
    profileNotificationsBtn: 'Community notifications',
    profileAdminBtn: 'Moderation & Disputes Panel',
    profileDiagnosticsBtn: 'Open technical diagnostics',
    profileSignOutBtn: 'Back to welcome screen',

    // Notifications
    notificationsTitle: 'Community inbox',
    notificationsSubtitle: 'Session updates, double-QR credit releases, verified reviews, and resolutions',
    notificationsMarkRead: 'Mark all read',
    notificationsEmptyTitle: 'No notifications yet',
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
