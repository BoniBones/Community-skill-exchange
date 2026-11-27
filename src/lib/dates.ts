/**
 * Date helpers. Rule: store/transport timestamps in UTC; convert to
 * America/Argentina/Buenos_Aires only for presentation and scheduling.
 *
 * Argentina has used UTC−03:00 year-round without DST since 2009. We use Intl with
 * the IANA zone when available and fall back to a fixed −3 h offset otherwise, so
 * rendering is correct even on JS engines without full time-zone data.
 */
import { config } from './config';
import { getActiveLocale, type SupportedLocale } from './i18n';

const BA_OFFSET_MIN = -180;

export const WEEKDAYS_BY_LOCALE: Record<SupportedLocale, readonly string[]> = {
  'es-AR': ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

export const MONTHS_BY_LOCALE: Record<SupportedLocale, readonly string[]> = {
  'es-AR': ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

interface LocalParts {
  year: number;
  month: number; // 0-11
  day: number;
  weekday: number; // 0 = Sunday
  hour: number;
  minute: number;
}

function partsViaIntl(d: Date): LocalParts | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hour12: false,
    });
    const map: Record<string, string> = {};
    for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday ?? '');
    if (wd < 0 || !map.year) return null;
    return {
      year: Number(map.year),
      month: Number(map.month) - 1,
      day: Number(map.day),
      weekday: wd,
      hour: Number(map.hour) % 24,
      minute: Number(map.minute),
    };
  } catch {
    return null;
  }
}

export function toBuenosAiresParts(utc: string | Date): LocalParts {
  const d = typeof utc === 'string' ? new Date(utc) : utc;
  const viaIntl = partsViaIntl(d);
  if (viaIntl) return viaIntl;
  const shifted = new Date(d.getTime() + BA_OFFSET_MIN * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "jueves 12 nov · 18:00" (es-AR) or "Thursday, Nov 12 · 18:00" (en) in Buenos Aires time. */
export function formatSessionDate(utc: string, locale: SupportedLocale = getActiveLocale()): string {
  const p = toBuenosAiresParts(utc);
  const safeLocale: SupportedLocale = locale === 'en' ? 'en' : 'es-AR';
  const weekdays = WEEKDAYS_BY_LOCALE[safeLocale];
  const months = MONTHS_BY_LOCALE[safeLocale];
  if (safeLocale === 'en') {
    return `${weekdays[p.weekday]}, ${months[p.month]} ${p.day} · ${pad(p.hour)}:${pad(p.minute)}`;
  }
  return `${weekdays[p.weekday]} ${p.day} ${months[p.month]} · ${pad(p.hour)}:${pad(p.minute)}`;
}

/** "12 nov 2026" (es-AR) or "Nov 12, 2026" (en) in Buenos Aires time. */
export function formatShortDate(utc: string, locale: SupportedLocale = getActiveLocale()): string {
  const p = toBuenosAiresParts(utc);
  const safeLocale: SupportedLocale = locale === 'en' ? 'en' : 'es-AR';
  const months = MONTHS_BY_LOCALE[safeLocale];
  if (safeLocale === 'en') {
    return `${months[p.month]} ${p.day}, ${p.year}`;
  }
  return `${p.day} ${months[p.month]} ${p.year}`;
}

/** "18:00" in Buenos Aires time. */
export function formatTime(utc: string): string {
  const p = toBuenosAiresParts(utc);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Validates that (year, month, day) represent a finite integer Gregorian calendar date
 * (month 1..12, day 1..31, exact UTC calendar round-trip with no rollover) not in the future,
 * with year >= minYear (default 1900).
 */
export function isValidBirthDate(
  year: number,
  month: number,
  day: number,
  options: { minYear?: number; now?: Date } = {},
): boolean {
  const minYear = options.minYear ?? 1900;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < minYear || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return false;
  }
  const now = options.now ?? new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dt.getTime() <= todayUtc;
}
