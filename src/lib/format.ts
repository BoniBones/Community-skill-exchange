import { getActiveLocale, type SupportedLocale } from './i18n';

/** Formats an integer credit amount, e.g. 1 → "1 crédito" / "1 credit", 2 → "2 créditos" / "2 credits". */
export function formatCredits(amount: number, locale: SupportedLocale = getActiveLocale()): string {
  if (!Number.isFinite(amount)) {
    return locale === 'en' ? '0 credits' : '0 créditos';
  }
  const whole = Math.round(amount);
  const abs = Math.abs(whole);
  const sign = whole < 0 ? '−' : '';
  if (locale === 'en') {
    return `${sign}${abs} ${abs === 1 ? 'credit' : 'credits'}`;
  }
  return `${sign}${abs} ${abs === 1 ? 'crédito' : 'créditos'}`;
}

export function formatDuration(min: number, locale: SupportedLocale = getActiveLocale()): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (locale === 'en') {
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
  }
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
