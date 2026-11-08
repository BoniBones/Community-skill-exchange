/**
 * Date helpers. Rule: store/transport timestamps in UTC; convert to
 * America/Argentina/Buenos_Aires only for presentation and scheduling.
 *
 * Argentina has used UTC−03:00 year-round without DST since 2009. We use Intl with
 * the IANA zone when available and fall back to a fixed −3 h offset otherwise, so
 * rendering is correct even on JS engines without full time-zone data.
 */
import { config } from './config';

const BA_OFFSET_MIN = -180;

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

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

/** "jueves 12 nov · 18:00" in Buenos Aires time. */
export function formatSessionDate(utc: string): string {
  const p = toBuenosAiresParts(utc);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month]} · ${pad(p.hour)}:${pad(p.minute)}`;
}

/** "12 nov 2026" in Buenos Aires time. */
export function formatShortDate(utc: string): string {
  const p = toBuenosAiresParts(utc);
  return `${p.day} ${MONTHS[p.month]} ${p.year}`;
}

/** "18:00" in Buenos Aires time. */
export function formatTime(utc: string): string {
  const p = toBuenosAiresParts(utc);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}
