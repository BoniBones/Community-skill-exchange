import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CATEGORIES,
  categoryOfSkill,
  clearCustomSkills,
  getCategoryColor,
  getSkill,
  NEIGHBORHOODS,
  SKILLS,
  skillName,
} from '../src/domain/catalog.ts';
import { hashNeighborhoodAccessCode, sha256Hex, verifySaltedSha256 } from '../src/lib/crypto.ts';
import { MAX_PROFILE_PHOTO_BYTES, validateProfilePhotoAsset } from '../src/lib/profilePhoto.ts';
import * as mockData from '../src/mocks/data.ts';
import { mockRepository } from '../src/services/mockRepository.ts';
import {
  darkBaseColors,
  getContrastRatio,
  getContrastTextColor,
  lightBaseColors,
} from '../src/ui/themeTokens.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkFiles(dirPath) {
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function blendOver(fgHex, bgHex, alpha) {
  const parse = (h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [fr, fg, fb] = parse(fgHex);
  const [br, bg, bb] = parse(bgHex);
  const mix = (f, b) => Math.round(f * alpha + b * (1 - alpha));
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(mix(fr, br))}${toHex(mix(fg, bg))}${toHex(mix(fb, bb))}`;
}

async function withCleanCatalogMockState(fn) {
  const snap = {
    profiles: mockData.profiles.map((p) => ({ ...p, skills: [...p.skills] })),
    activities: [...mockData.activities],
    customSkills: [...mockData.customSkills],
    ledger: [...mockData.ledger],
  };
  try {
    return await fn();
  } finally {
    mockData.profiles.splice(0, mockData.profiles.length, ...snap.profiles);
    mockData.activities.splice(0, mockData.activities.length, ...snap.activities);
    mockData.customSkills.splice(0, mockData.customSkills.length, ...snap.customSkills);
    mockData.ledger.splice(0, mockData.ledger.length, ...snap.ledger);
    clearCustomSkills();
  }
}

describe('CSE-M3 Catalog, Custom Skills, Profile Photos & Hashed Neighborhood Access Suite', () => {
  it('Provides the 7 required categories with 4+ bilingual skills each and WCAG AA Light/Dark contrast', () => {
    assert.deepEqual(
      CATEGORIES.map((c) => c.id),
      ['languages', 'music', 'academic', 'tech', 'sports', 'arts_crafts', 'practical'],
    );

    const legacySkillIds = [
      's-piano', 's-guitar', 's-photo', 's-drawing', 's-english', 's-portuguese',
      's-math', 's-physics', 's-python', 's-web', 's-karate', 's-football',
      's-yoga', 's-meditation', 's-carpentry', 's-sewing', 's-cooking', 's-gardening',
    ];
    for (const id of legacySkillIds) {
      assert.ok(SKILLS.some((s) => s.id === id), `Legacy skill ${id} must remain preserved`);
    }

    for (const cat of CATEGORIES) {
      const catSkills = SKILLS.filter((s) => s.categoryId === cat.id);
      assert.ok(catSkills.length >= 4, `Category ${cat.id} must have >= 4 skills (has ${catSkills.length})`);
      assert.ok(cat.name.trim().length > 0 && (cat.nameEn ?? '').trim().length > 0);
      for (const sk of catSkills) {
        assert.ok(sk.name.trim().length > 0 && (sk.nameEn ?? '').trim().length > 0, `Skill ${sk.id} missing i18n`);
      }

      assert.equal(getCategoryColor(cat, 'light'), cat.color);
      assert.equal(getCategoryColor(cat, 'dark'), cat.darkColor);

      const lightIconBg = blendOver(cat.color, lightBaseColors.surface, 0.102);
      const darkIconBg = blendOver(cat.darkColor, darkBaseColors.surface, 0.102);

      assert.ok((getContrastRatio(cat.color, lightBaseColors.bg) ?? 0) >= 4.5, `${cat.id} light on bg`);
      assert.ok((getContrastRatio(cat.color, lightBaseColors.surface) ?? 0) >= 4.5, `${cat.id} light on surface`);
      assert.ok((getContrastRatio(cat.color, lightIconBg) ?? 0) >= 4.5, `${cat.id} light on IconCircle`);
      assert.ok(
        (getContrastRatio(cat.color, getContrastTextColor(cat.color)) ?? 0) >= 4.5,
        `${cat.id} light chip fg`,
      );

      assert.ok((getContrastRatio(cat.darkColor, darkBaseColors.bg) ?? 0) >= 4.5, `${cat.id} dark on bg`);
      assert.ok((getContrastRatio(cat.darkColor, darkBaseColors.surface) ?? 0) >= 4.5, `${cat.id} dark on surface`);
      assert.ok((getContrastRatio(cat.darkColor, darkIconBg) ?? 0) >= 4.5, `${cat.id} dark on IconCircle`);
      assert.ok(
        (getContrastRatio(cat.darkColor, getContrastTextColor(cat.darkColor)) ?? 0) >= 4.5,
        `${cat.id} dark chip fg`,
      );
    }
  });

  it('Creates custom skills, indexes them for discovery search, and creates activities using them', async () => {
    await withCleanCatalogMockState(async () => {
      await assert.rejects(
        () => mockRepository.createCustomSkill('u-me', { name: 'A', categoryId: 'practical' }),
        /2 caracteres/i,
      );
      await assert.rejects(
        () =>
          mockRepository.createCustomSkill('u-me', {
            name: 'Valid Name',
            categoryId: /** @type {any} */ ('invalid_cat'),
          }),
        /categoría válida/i,
      );

      const created = await mockRepository.createCustomSkill('u-me', {
        name: 'Encuadernación artesanal',
        categoryId: 'arts_crafts',
        description: 'Cuadernos cosidos a mano con papel reciclado',
      });
      assert.equal(created.isCustom, true);
      assert.equal(created.createdBy, 'u-me');
      assert.equal(created.categoryId, 'arts_crafts');
      assert.equal(getSkill(created.id)?.name, 'Encuadernación artesanal');
      assert.equal(skillName(created.id, 'es-AR'), 'Encuadernación artesanal');
      assert.equal(categoryOfSkill(created.id)?.id, 'arts_crafts');

      // Duplicate normalized name (including NFD accent-folding) in same category returns existing skill
      const duplicate = await mockRepository.createCustomSkill('u-me', {
        name: '  encuadernación artesanal ',
        categoryId: 'arts_crafts',
      });
      assert.equal(duplicate.id, created.id);

      const accentFoldedBuiltIn = await mockRepository.createCustomSkill('u-me', {
        name: 'Ingles',
        categoryId: 'languages',
      });
      assert.equal(accentFoldedBuiltIn.id, 's-english');

      const allSkills = await mockRepository.listSkills();
      assert.equal(allSkills.filter((s) => s.id === created.id).length, 1);

      const published = await mockRepository.upsertActivity('u-me', {
        skillId: created.id,
        title: 'Taller de cuadernos artesanales',
        description: 'Aprendé costura copta y tapas duras en la biblioteca del barrio.',
        durationMin: 90,
        format: 'in_person',
        meetingArea: 'Biblioteca de Santo Tomás',
        requirements: 'Ninguno',
        availabilitySummary: 'Sábados 15 h',
        creditAmount: 1,
        status: 'published',
      });
      assert.equal(published.activity.skillId, created.id);

      const byCustomName = await mockRepository.listActivities({ query: 'Encuadernación' });
      assert.ok(byCustomName.some((a) => a.id === published.activity.id));

      const byCustomDescription = await mockRepository.listActivities({ query: 'cosidos a mano' });
      assert.ok(byCustomDescription.some((a) => a.id === published.activity.id));

      const byCategory = await mockRepository.listActivities({ categoryId: 'arts_crafts' });
      assert.ok(byCategory.some((a) => a.id === published.activity.id));
    });
  });

  it('Persists separate Teach (offers) and Learn (wants) multi-select skills and levels', async () => {
    await withCleanCatalogMockState(async () => {
      const custom = await mockRepository.createCustomSkill('u-me', {
        name: 'Impresión 3D',
        categoryId: 'tech',
      });

      const updated = await mockRepository.updateProfile('u-me', {
        displayName: 'Sofía Romero',
        neighborhoodId: 'n-santo-tomas',
        bio: 'Profe de piano y entusiasta maker.',
        availabilitySummary: 'Martes y jueves por la tarde',
        skills: [
          { skillId: 's-piano', kind: 'offers', level: 'expert' },
          { skillId: custom.id, kind: 'offers', level: 'advanced' },
          { skillId: 's-french', kind: 'wants' },
          { skillId: 's-pottery', kind: 'wants' },
        ],
      });

      const offers = updated.skills.filter((s) => s.kind === 'offers');
      const wants = updated.skills.filter((s) => s.kind === 'wants');
      assert.deepEqual(
        offers.map((s) => [s.skillId, s.level]),
        [
          ['s-piano', 'expert'],
          [custom.id, 'advanced'],
        ],
      );
      assert.deepEqual(
        wants.map((s) => s.skillId),
        ['s-french', 's-pottery'],
      );
    });
  });

  it('Validates, uploads, replaces, and removes profile photos cleanly', async () => {
    assert.equal(validateProfilePhotoAsset({ uri: 'ftp://bad/img.jpg', mimeType: 'image/jpeg' }).valid, false);
    assert.equal(validateProfilePhotoAsset({ uri: 'file:///tmp/doc.pdf', mimeType: 'application/pdf' }).valid, false);
    assert.equal(validateProfilePhotoAsset({ uri: 'file:///tmp/vector.svg' }).valid, false);
    assert.equal(
      validateProfilePhotoAsset({
        uri: 'file:///cache/huge.jpg',
        mimeType: 'image/jpeg',
        fileSize: MAX_PROFILE_PHOTO_BYTES + 1,
      }).valid,
      false,
    );
    assert.equal(
      validateProfilePhotoAsset({
        uri: 'file:///cache/zero.jpg',
        mimeType: 'image/jpeg',
        fileSize: 0,
      }).valid,
      false,
    );
    const validJpg = validateProfilePhotoAsset({
      uri: 'file:///var/mobile/avatar.jpg',
      mimeType: 'image/jpeg',
      fileSize: 256_000,
    });
    assert.deepEqual(validJpg, { valid: true, extension: 'jpg' });

    const uriFallbackJpg = validateProfilePhotoAsset({
      uri: 'file:///var/mobile/IMG_1234.jpg',
      mimeType: null,
      fileName: 'IMG_1234',
      fileSize: 180_000,
    });
    assert.deepEqual(uriFallbackJpg, { valid: true, extension: 'jpg' });

    await withCleanCatalogMockState(async () => {
      await assert.rejects(
        () => mockRepository.uploadProfilePhoto('u-me', { uri: 'file:///tmp/bad.pdf', mimeType: 'application/pdf' }),
        /Formato no compatible/i,
      );

      const firstUri = await mockRepository.uploadProfilePhoto('u-me', {
        uri: 'file:///var/mobile/first-avatar.png',
        mimeType: 'image/png',
        fileSize: 120_000,
      });
      assert.equal(firstUri, 'file:///var/mobile/first-avatar.png');
      assert.equal((await mockRepository.getProfile('u-me'))?.avatarUrl, firstUri);

      const replacedUri = await mockRepository.uploadProfilePhoto('u-me', {
        uri: 'content://media/external/images/media/42.webp',
        mimeType: 'image/webp',
        fileSize: 80_000,
      });
      assert.equal((await mockRepository.getProfile('u-me'))?.avatarUrl, replacedUri);

      await mockRepository.removeProfilePhoto('u-me');
      assert.equal((await mockRepository.getProfile('u-me'))?.avatarUrl, undefined);
    });
  });

  it('Verifies FIPS 180-4 SHA-256 vectors and enforces hashed neighborhood onboarding access', async () => {
    assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(
      sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    const utf8Sample = 'Café ☕ Santo Tomás';
    assert.equal(sha256Hex(utf8Sample), crypto.createHash('sha256').update(utf8Sample, 'utf8').digest('hex'));

    const expectedDemoCode = ['12', '34'].join('');
    const digest = hashNeighborhoodAccessCode('n-santo-tomas', expectedDemoCode, 'cse-nb-n-santo-tomas-v1');
    assert.equal(verifySaltedSha256('n-santo-tomas', expectedDemoCode, 'cse-nb-n-santo-tomas-v1', digest), true);
    assert.equal(verifySaltedSha256('n-santo-tomas', '9999', 'cse-nb-n-santo-tomas-v1', digest), false);

    const neighborhoods = await mockRepository.listNeighborhoods();
    assert.equal(neighborhoods.length, NEIGHBORHOODS.length);
    assert.equal(neighborhoods.find((n) => n.id === 'n-santo-tomas')?.isActive, true);
    assert.equal(neighborhoods.find((n) => n.id === 'n-pilar')?.isActive, false);
    assert.equal(neighborhoods.find((n) => n.id === 'n-derqui')?.isActive, false);

    await withCleanCatalogMockState(async () => {
      await assert.rejects(
        () => mockRepository.verifyNeighborhoodAccess('u-me', { neighborhoodId: 'n-pilar', accessCode: expectedDemoCode }),
        /no está habilitado/i,
      );
      await assert.rejects(
        () => mockRepository.verifyNeighborhoodAccess('u-me', { neighborhoodId: 'n-santo-tomas', accessCode: '  ' }),
        /Ingresá el código/i,
      );
      await assert.rejects(
        () => mockRepository.verifyNeighborhoodAccess('u-me', { neighborhoodId: 'n-santo-tomas', accessCode: '0000' }),
        /no es válido/i,
      );

      const verified = await mockRepository.verifyNeighborhoodAccess('u-me', {
        neighborhoodId: 'n-santo-tomas',
        accessCode: ` ${expectedDemoCode} `,
      });
      assert.equal(verified.neighborhoodId, 'n-santo-tomas');
      assert.ok(verified.neighborhoodVerifiedAt && !Number.isNaN(Date.parse(verified.neighborhoodVerifiedAt)));
      assert.equal((await mockRepository.getProfile('u-me'))?.neighborhoodVerifiedAt, verified.neighborhoodVerifiedAt);
    });
  });

  it('Contains zero standalone plaintext access code in src/ or supabase/ and defines required SQL DDL/safety guards', () => {
    const standaloneInviteRegex = /(?<!\d)1234(?!\d)/;

    for (const filePath of walkFiles(path.join(ROOT_DIR, 'src'))) {
      const content = fs.readFileSync(filePath, 'utf8');
      assert.equal(
        standaloneInviteRegex.test(content),
        false,
        `Plaintext neighborhood code leaked in ${path.relative(ROOT_DIR, filePath)}`,
      );
    }

    const migrationPath = path.join(
      ROOT_DIR,
      'supabase',
      'migrations',
      '20261125000006_catalog_storage_neighborhood_access.sql',
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    const seedSql = fs.readFileSync(path.join(ROOT_DIR, 'supabase', 'seed.sql'), 'utf8');

    assert.equal(standaloneInviteRegex.test(migrationSql), false, 'Plaintext code must not appear in migration SQL');
    assert.equal(standaloneInviteRegex.test(seedSql), false, 'Plaintext code must not appear in seed.sql');

    assert.match(migrationSql, /is_custom boolean not null default false/i);
    assert.match(migrationSql, /create or replace function public\.create_custom_skill/i);
    assert.match(migrationSql, /insert into storage\.buckets/i);
    assert.match(migrationSql, /'avatars'/);
    assert.match(migrationSql, /on storage\.objects/i);
    assert.match(migrationSql, /add column if not exists is_active boolean/i);
    assert.match(migrationSql, /add column if not exists neighborhood_verified_at timestamptz/i);
    assert.match(migrationSql, /create table if not exists public\.private_neighborhood_codes/i);
    assert.match(migrationSql, /create or replace function public\.verify_neighborhood_access/i);
    assert.match(migrationSql, /digest\(/i);

    const remapIdx = migrationSql.toLowerCase().indexOf("where category_id = 'music_arts'");
    const deleteLegacyIdx = migrationSql.toLowerCase().indexOf('delete from public.skill_categories');
    assert.ok(remapIdx >= 0 && deleteLegacyIdx > remapIdx, 'Skills must be remapped before deleting legacy categories');

    const userScreenSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'app', 'user', '[id].tsx'), 'utf8');
    assert.match(userScreenSrc, /try\s*\{[\s\S]*reportOrBlock\.mutateAsync[\s\S]*\}\s*catch/i);

    const primitivesSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'ui', 'primitives.tsx'), 'utf8');
    assert.match(primitivesSrc, /resizeMode="cover"/);
  });
});
