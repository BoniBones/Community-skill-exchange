import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { CATEGORIES, categoryName, SKILLS, skillName } from '../src/domain/catalog.ts';
import { formatSessionDate, formatShortDate } from '../src/lib/dates.ts';
import { formatCredits, formatDuration } from '../src/lib/format.ts';
import {
  dictionaries,
  getActiveLocale,
  hydrateLocale,
  LOCALE_STORAGE_KEY,
  setActiveLocale,
  t,
} from '../src/lib/i18n.ts';
import { runPilotReadinessAudit } from '../src/lib/pilotAudit.ts';
import { getStoredItem, setStoredItem } from '../src/lib/storage.ts';
import {
  ACCENT_IDS,
  ACCENT_PALETTES,
  getContrastRatio,
  getContrastTextColor,
  isAccentId,
  isThemeMode,
  resolveThemeColors,
  resolveThemeMode,
} from '../src/ui/themeTokens.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function extractPlaceholders(str) {
  const matches = str.match(/\{[a-zA-Z0-9_]+\}/g) ?? [];
  return Array.from(new Set(matches)).sort();
}

describe('CSE-M2 Internationalization, Storage & Theme Suite', () => {
  it('Maintains 100% key parity, non-empty values, and placeholder parity between es-AR and en', () => {
    const esKeys = Object.keys(dictionaries['es-AR']).sort();
    const enKeys = Object.keys(dictionaries.en).sort();

    assert.deepEqual(enKeys, esKeys, 'es-AR and en must contain the exact same key set');
    assert.ok(esKeys.length > 100, 'Dictionaries should have comprehensive screen coverage');

    for (const key of esKeys) {
      const esVal = dictionaries['es-AR'][key];
      const enVal = dictionaries.en[key];
      assert.equal(typeof esVal, 'string');
      assert.equal(typeof enVal, 'string');
      assert.ok(esVal.trim().length > 0, `es-AR.${key} must not be empty or whitespace`);
      assert.ok(enVal.trim().length > 0, `en.${key} must not be empty or whitespace`);

      const esPlaceholders = extractPlaceholders(esVal);
      const enPlaceholders = extractPlaceholders(enVal);
      assert.deepEqual(
        enPlaceholders,
        esPlaceholders,
        `Placeholder mismatch for key "${key}": es-AR=${JSON.stringify(esPlaceholders)} vs en=${JSON.stringify(enPlaceholders)}`,
      );
    }
  });

  it('Formats credits, durations, dates, categories, and skills in both es-AR and en', () => {
    assert.equal(formatCredits(1, 'es-AR'), '1 crédito');
    assert.equal(formatCredits(2, 'es-AR'), '2 créditos');
    assert.equal(formatCredits(1, 'en'), '1 credit');
    assert.equal(formatCredits(2, 'en'), '2 credits');

    assert.equal(formatDuration(60, 'es-AR'), '1 h');
    assert.equal(formatDuration(90, 'es-AR'), '1 h 30 min');
    assert.equal(formatDuration(60, 'en'), '1 hr');
    assert.equal(formatDuration(90, 'en'), '1 hr 30 min');

    const sampleUtc = '2026-11-10T22:00:00.000Z';
    const esSessionDate = formatSessionDate(sampleUtc, 'es-AR');
    const enSessionDate = formatSessionDate(sampleUtc, 'en');
    assert.ok(esSessionDate.includes('19:00'), `Expected 19:00 in "${esSessionDate}"`);
    assert.ok(enSessionDate.includes('19:00'), `Expected 19:00 in "${enSessionDate}"`);
    assert.notEqual(esSessionDate, enSessionDate);

    const esShort = formatShortDate(sampleUtc, 'es-AR');
    const enShort = formatShortDate(sampleUtc, 'en');
    assert.ok(esShort.includes('nov') && esShort.includes('2026'));
    assert.ok(enShort.includes('Nov') && enShort.includes('2026'));

    for (const cat of CATEGORIES) {
      const esCat = categoryName(cat.id, 'es-AR');
      const enCat = categoryName(cat.id, 'en');
      assert.ok(esCat.trim().length > 0);
      assert.ok(enCat.trim().length > 0);
    }
    assert.equal(categoryName('languages', 'es-AR'), 'Idiomas');
    assert.equal(categoryName('languages', 'en'), 'Languages');

    for (const sk of SKILLS) {
      const esSk = skillName(sk.id, 'es-AR');
      const enSk = skillName(sk.id, 'en');
      assert.ok(esSk.trim().length > 0);
      assert.ok(enSk.trim().length > 0);
    }
    assert.equal(skillName('s-cooking', 'es-AR'), 'Cocina');
    assert.equal(skillName('s-cooking', 'en'), 'Cooking');
  });

  it('Switches locale live, persists via Node-safe storage fallback, and passes pilotAudit in both locales', async () => {
    const initial = getActiveLocale();
    try {
      assert.equal(initial, 'es-AR');

      setActiveLocale('en');
      assert.equal(getActiveLocale(), 'en');
      assert.equal(t('navSettings'), 'Settings');
      assert.equal(t('exploreCountSingle', { count: 1 }), '1 activity available');
      assert.equal(await getStoredItem(LOCALE_STORAGE_KEY), 'en');

      const enAudit = runPilotReadinessAudit({
        ledgerHealthy: true,
        invariantCount: 5,
        passedInvariants: 5,
      });
      assert.equal(enAudit.readyForPilot, true, 'Pilot audit must pass even when UI is in en mode');
      assert.equal(
        enAudit.checks.find((c) => c.id === 'integer-non-cashable-credits')?.passed,
        true,
      );

      await setStoredItem(LOCALE_STORAGE_KEY, 'es-AR');
      const hydrated = await hydrateLocale();
      assert.equal(hydrated, 'es-AR');
      assert.equal(getActiveLocale(), 'es-AR');
      assert.equal(t('navSettings'), 'Configuración');
    } finally {
      setActiveLocale(initial);
    }
  });

  it('Resolves distinct Light and Dark palettes across all AccentIds without importing react-native', () => {
    const tokensSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'ui', 'themeTokens.ts'), 'utf8');
    assert.equal(/from\s+['"]react-native['"]/.test(tokensSrc), false, 'themeTokens.ts must not import react-native');

    const themeSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'ui', 'theme.ts'), 'utf8');
    assert.equal(/export\s+const\s+colors\b/.test(themeSrc), false, 'Static colors export must remain removed');

    assert.equal(resolveThemeMode('light', 'dark'), 'light');
    assert.equal(resolveThemeMode('dark', 'light'), 'dark');
    assert.equal(resolveThemeMode('system', 'dark'), 'dark');
    assert.equal(resolveThemeMode('system', 'light'), 'light');
    assert.equal(resolveThemeMode('system', null), 'light');

    assert.equal(isThemeMode('system'), true);
    assert.equal(isThemeMode('invalid'), false);
    assert.equal(isAccentId('indigo'), true);
    assert.equal(isAccentId('purple'), false);

    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    const lightPrimaries = new Set();

    for (const accentId of ACCENT_IDS) {
      const light = resolveThemeColors('light', accentId);
      const dark = resolveThemeColors('dark', accentId);

      assert.notEqual(light.bg, dark.bg, `${accentId} light and dark bg must differ`);
      assert.notEqual(light.surface, dark.surface, `${accentId} light and dark surface must differ`);
      assert.notEqual(light.text, dark.text, `${accentId} light and dark text must differ`);
      lightPrimaries.add(light.primary);

      for (const palette of [light, dark]) {
        for (const [tokenKey, tokenVal] of Object.entries(palette)) {
          assert.match(tokenVal, hexRegex, `Invalid hex color for ${accentId}.${tokenKey}: ${tokenVal}`);
        }
      }
    }

    assert.equal(lightPrimaries.size, ACCENT_IDS.length, 'Each AccentId must define a distinct primary color');
  });

  it('Computes WCAG AA contrast text colors for category chips, avatar swatches, and edge inputs', () => {
    for (const cat of CATEGORIES) {
      const fg = getContrastTextColor(cat.color);
      const ratio = getContrastRatio(cat.color, fg);
      assert.ok(ratio !== null && ratio >= 4.5, `Category ${cat.id} (${cat.color}) with ${fg} contrast ${ratio} < 4.5`);
    }

    const avatarSwatches = ['#0F766E', '#C2410C', '#7C3AED', '#2563EB', '#B45309', '#15803D', '#BE185D'];
    for (const hex of avatarSwatches) {
      const fg = getContrastTextColor(hex);
      const ratio = getContrastRatio(hex, fg);
      assert.ok(ratio !== null && ratio >= 5.0, `Avatar swatch ${hex} with ${fg} contrast ${ratio} < 5.0`);
    }

    const fixedSwatches = [
      '#000000',
      '#111315',
      '#1A1D21',
      '#FFFFFF',
      '#FAF7F2',
      '#F5F5F4',
      ...ACCENT_IDS.flatMap((id) => [
        ACCENT_PALETTES[id].swatch,
        ACCENT_PALETTES[id].light.accent,
        ACCENT_PALETTES[id].dark.accent,
      ]),
    ];
    for (const hex of fixedSwatches) {
      const fg = getContrastTextColor(hex);
      const ratio = getContrastRatio(hex, fg);
      assert.ok(ratio !== null && ratio >= 4.5, `Swatch ${hex} with ${fg} contrast ${ratio} < 4.5`);
    }

    assert.equal(getContrastTextColor('#000000'), '#FFFFFF');
    assert.equal(getContrastTextColor('#FFFFFF'), '#111315');
    assert.equal(getContrastTextColor('not-a-hex'), '#FFFFFF');
    assert.equal(getContrastTextColor(''), '#FFFFFF');
  });

  it('Guards runtime invalid locales and localizes Supabase health status keys', () => {
    const sampleUtc = '2026-11-10T22:00:00.000Z';

    assert.doesNotThrow(() => t('navSettings', 'invalid'));
    assert.equal(t('navSettings', 'invalid'), dictionaries['es-AR'].navSettings);
    assert.equal(t('exploreCountSingle', { count: 1 }, 'invalid'), dictionaries['es-AR'].exploreCountSingle.replace('{count}', '1'));

    assert.doesNotThrow(() => formatSessionDate(sampleUtc, 'invalid'));
    assert.equal(formatSessionDate(sampleUtc, 'invalid'), formatSessionDate(sampleUtc, 'es-AR'));
    assert.doesNotThrow(() => formatShortDate(sampleUtc, 'invalid'));
    assert.equal(formatShortDate(sampleUtc, 'invalid'), formatShortDate(sampleUtc, 'es-AR'));

    assert.equal(t('sbConnectedDetail', { status: 200 }, 'en'), 'Connected (HTTP 200)');
    assert.equal(t('sbConnectedDetail', { status: 200 }, 'es-AR'), 'Conectado (HTTP 200)');
    assert.ok(t('sbMissingEnv', 'en').includes('EXPO_PUBLIC_SUPABASE_URL'));
    assert.ok(t('sbHttpErrorDetail', { status: 503 }, 'en').includes('503'));
    assert.ok(t('sbNetworkErrorDetail', { message: 'timeout' }, 'en').includes('timeout'));

    const supabaseSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'supabase.ts'), 'utf8');
    assert.equal(/Conectado \(HTTP|Sin conexión:|Faltan EXPO_PUBLIC_/.test(supabaseSrc), false);
    assert.equal(/t\('sbMissingEnv'\)/.test(supabaseSrc), true);
  });
});
