import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import * as mockData from '../src/mocks/data.ts';
import { isValidBirthDate } from '../src/lib/dates.ts';
import { mockRepository, SAFETY_POLICY_CONSTANTS, verifyWalletInvariants } from '../src/services/mockRepository.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function withCleanMockState(fn) {
  const snap = {
    profiles: mockData.profiles.map((p) => ({ ...p, skills: [...p.skills] })),
    activities: [...mockData.activities],
    sessions: [...mockData.sessions],
    ledger: [...mockData.ledger],
    reviews: [...mockData.reviews],
    verificationTokens: [...mockData.verificationTokens],
    notifications: [...mockData.notifications],
    disputes: [...mockData.disputes],
    reports: [...mockData.reports],
  };
  try {
    return await fn();
  } finally {
    mockData.profiles.splice(0, mockData.profiles.length, ...snap.profiles);
    mockData.activities.splice(0, mockData.activities.length, ...snap.activities);
    mockData.sessions.splice(0, mockData.sessions.length, ...snap.sessions);
    mockData.ledger.splice(0, mockData.ledger.length, ...snap.ledger);
    mockData.reviews.splice(0, mockData.reviews.length, ...snap.reviews);
    mockData.verificationTokens.splice(0, mockData.verificationTokens.length, ...snap.verificationTokens);
    mockData.notifications.splice(0, mockData.notifications.length, ...snap.notifications);
    mockData.disputes.splice(0, mockData.disputes.length, ...snap.disputes);
    mockData.reports.splice(0, mockData.reports.length, ...snap.reports);
  }
}

describe('CSE-M4 Safety Invariants, QR Parity, Disputes & SQL Hardening Suite', () => {
  it('Enforces 18+ age gate (<13, 13-17, unchecked safety rules, 18+) in submitEligibility', async () => {
    await withCleanMockState(async () => {
      const year = new Date().getUTCFullYear();

      const unchecked = await mockRepository.submitEligibility('u-me', {
        birthYear: year - 25,
        birthMonth: 5,
        birthDay: 10,
        acceptedSafetyRules: false,
      });
      assert.equal(unchecked.eligible, false);
      assert.equal(unchecked.status, 'pending_eligibility');

      const under13 = await mockRepository.submitEligibility('u-me', {
        birthYear: year - 11,
        birthMonth: 5,
        birthDay: 10,
        acceptedSafetyRules: true,
      });
      assert.equal(under13.eligible, false);
      assert.equal(under13.status, 'restricted');

      const minor = await mockRepository.submitEligibility('u-me', {
        birthYear: year - 16,
        birthMonth: 5,
        birthDay: 10,
        acceptedSafetyRules: true,
        guardianEmail: 'parent@example.com',
      });
      assert.equal(minor.eligible, false);
      assert.equal(minor.status, 'restricted');

      const adult = await mockRepository.submitEligibility('u-me', {
        birthYear: year - 25,
        birthMonth: 5,
        birthDay: 10,
        acceptedSafetyRules: true,
      });
      assert.equal(adult.eligible, true);
      assert.equal(adult.status, 'active');
      assert.equal((await mockRepository.getProfile('u-me'))?.status, 'active');
    });
  });

  it('Rejects impossible Gregorian calendar dates and future birth dates while accepting valid leap day 2000-02-29', async () => {
    await withCleanMockState(async () => {
      const meIdx = mockData.profiles.findIndex((p) => p.id === 'u-me');
      mockData.profiles[meIdx] = { ...mockData.profiles[meIdx], status: 'pending_eligibility' };

      const now = new Date();
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

      const invalidDates = [
        { birthYear: 1996, birthMonth: 2, birthDay: 30 },
        { birthYear: 1996, birthMonth: 4, birthDay: 31 },
        { birthYear: 2001, birthMonth: 2, birthDay: 29 },
        { birthYear: 1900, birthMonth: 2, birthDay: 29 },
        { birthYear: 1899, birthMonth: 5, birthDay: 10 },
        { birthYear: 1996.5, birthMonth: 5, birthDay: 10 },
        {
          birthYear: tomorrow.getUTCFullYear(),
          birthMonth: tomorrow.getUTCMonth() + 1,
          birthDay: tomorrow.getUTCDate(),
        },
        { birthYear: now.getUTCFullYear() + 1, birthMonth: 1, birthDay: 1 },
      ];

      for (const bad of invalidDates) {
        await assert.rejects(
          () =>
            mockRepository.submitEligibility('u-me', {
              ...bad,
              acceptedSafetyRules: true,
            }),
          /fecha de nacimiento válida|valid birth date/i,
        );
      }
      assert.equal((await mockRepository.getProfile('u-me'))?.status, 'pending_eligibility');

      // UI helper boundary checks (minYear: 1920, non-future today boundary)
      assert.equal(isValidBirthDate(1919, 12, 31, { minYear: 1920, now }), false);
      assert.equal(isValidBirthDate(1996, 2, 30, { minYear: 1920, now }), false);
      assert.equal(
        isValidBirthDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), { minYear: 1920, now }),
        true,
      );
      assert.equal(
        isValidBirthDate(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), {
          minYear: 1920,
          now,
        }),
        false,
      );

      // Valid leap day (2000-02-29, 18+) is accepted
      const leapAdult = await mockRepository.submitEligibility('u-me', {
        birthYear: 2000,
        birthMonth: 2,
        birthDay: 29,
        acceptedSafetyRules: true,
      });
      assert.equal(leapAdult.eligible, true);
      assert.equal(leapAdult.status, 'active');
      assert.equal((await mockRepository.getProfile('u-me'))?.status, 'active');
    });
  });

  it('Rejects private home addresses in upsertActivity while allowing public spaces and online', async () => {
    await withCleanMockState(async () => {
      for (const badArea of ['Mi casa', 'Domicilio particular 450', 'Depto 3B', 'Departamento en Pilar']) {
        await assert.rejects(
          () =>
            mockRepository.upsertActivity('u-me', {
              skillId: 's-piano',
              title: 'Clase privada rechazada',
              description: 'Debe fallar por indicar un domicilio particular.',
              durationMin: 60,
              format: 'in_person',
              meetingArea: badArea,
              requirements: 'Ninguno',
              availabilitySummary: 'Sábados 10 h',
              creditAmount: 1,
              status: 'published',
            }),
          /domicilio particular/i,
        );
      }

      const ok = await mockRepository.upsertActivity('u-me', {
        skillId: 's-piano',
        title: 'Clase en espacio público',
        description: 'Encuentro abierto en biblioteca pública del barrio.',
        durationMin: 60,
        format: 'in_person',
        meetingArea: 'Biblioteca Popular de Santo Tomás',
        requirements: 'Ninguno',
        availabilitySummary: 'Sábados 10 h',
        creditAmount: 1,
        status: 'published',
      });
      assert.equal(ok.activity.meetingArea, 'Biblioteca Popular de Santo Tomás');
    });
  });

  it('Enforces double-entry integer-only non-cashable escrow and MAX_BALANCE = 20 cap', async () => {
    await withCleanMockState(async () => {
      assert.equal(SAFETY_POLICY_CONSTANTS.maxBalance, 20);
      const before = await mockRepository.getWallet('u-me');
      assert.equal(before.maxBalance, 20);
      assert.equal(Number.isInteger(before.available), true);

      const ses = await mockRepository.requestSession('u-me', {
        activityId: 'a-math',
        startsAt: '2026-12-01T21:00:00.000Z',
      });
      const held = await mockRepository.getWallet('u-me');
      assert.equal(held.available, before.available - 1);
      assert.equal(held.heldInEscrow, before.heldInEscrow + 1);

      const report = verifyWalletInvariants(held, mockData.sessions);
      assert.equal(report.healthy, true);
      assert.equal(report.maxBalance, 20);
      assert.equal(
        report.invariants.every((i) => i.passed),
        true,
      );
      assert.equal(ses.creditAmount, 1);
    });
  });

  it('Enforces 2-stage QR token TTL, single-use, missing token rejection, self-redeem block, invalid-state non-burning, and atomic release', async () => {
    await withCleanMockState(async () => {
      assert.equal(SAFETY_POLICY_CONSTANTS.qrTokenTtlSeconds, 90);
      const before = await mockRepository.getWallet('u-me');

      // 1. Missing/bogus code is rejected
      await assert.rejects(
        () =>
          mockRepository.redeemSessionToken('u-camila', {
            sessionId: 'ses-piano-camila',
            phase: 'check_in',
            code: 'BOGUS1',
          }),
        /inválido o ya fue utilizado/i,
      );

      // 2. Self-redemption is blocked
      const tokIn = await mockRepository.issueSessionToken('u-me', {
        sessionId: 'ses-piano-camila',
        phase: 'check_in',
      });
      await assert.rejects(
        () =>
          mockRepository.redeemSessionToken('u-me', {
            sessionId: 'ses-piano-camila',
            phase: 'check_in',
            code: tokIn.code,
          }),
        /contraparte debe escanear/i,
      );

      // 3. Invalid-state call (check_out on confirmed session) does NOT burn an issued check_in token,
      //    and check_out requires check_in first
      await assert.rejects(
        () =>
          mockRepository.redeemSessionToken('u-camila', {
            sessionId: 'ses-piano-camila',
            phase: 'check_out',
            code: tokIn.code,
          }),
        /inválido o ya fue utilizado/i,
      );
      const tokenEntryStillUnused = mockData.verificationTokens.find((t) => t.id === tokIn.id);
      assert.equal(tokenEntryStillUnused?.usedAt, undefined);

      // Simulate an unmatched/mismatched check_out token directly on a confirmed session to verify non-burning
      mockData.verificationTokens.unshift({
        id: 'tok-pre-checkout',
        sessionId: 'ses-piano-camila',
        phase: 'check_out',
        issuerId: 'u-me',
        code: 'EARLY9',
        tokenHash: 'hash-early-9',
        qrPayload: 'cse://verify?session=ses-piano-camila&phase=check_out&code=EARLY9',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      await assert.rejects(
        () =>
          mockRepository.redeemSessionToken('u-camila', {
            sessionId: 'ses-piano-camila',
            phase: 'check_out',
            code: 'EARLY9',
          }),
        /check-in de inicio/i,
      );
      assert.equal(
        mockData.verificationTokens.find((t) => t.id === 'tok-pre-checkout')?.usedAt,
        undefined,
        'Invalid-state redemption must not burn a valid token',
      );

      // 4. Expired token (90s TTL) is rejected
      mockData.verificationTokens.unshift({
        id: 'tok-expired-1',
        sessionId: 'ses-piano-camila',
        phase: 'check_in',
        issuerId: 'u-me',
        code: 'EXPRD1',
        tokenHash: 'hash-exprd-1',
        qrPayload: 'cse://verify?session=ses-piano-camila&phase=check_in&code=EXPRD1',
        expiresAt: new Date(Date.now() - 5_000).toISOString(),
      });
      await assert.rejects(
        () =>
          mockRepository.redeemSessionToken('u-camila', {
            sessionId: 'ses-piano-camila',
            phase: 'check_in',
            code: 'EXPRD1',
          }),
        /expiró/i,
      );

      // 5. Happy check-in
      const checkedIn = await mockRepository.redeemSessionToken('u-camila', {
        sessionId: 'ses-piano-camila',
        phase: 'check_in',
        code: tokIn.code,
      });
      assert.equal(checkedIn.session.state, 'in_progress');
      assert.equal(checkedIn.releasedCredits, 0);

      // 6. Single-use replay rejected
      await assert.rejects(
        () =>
          mockRepository.redeemSessionToken('u-camila', {
            sessionId: 'ses-piano-camila',
            phase: 'check_in',
            code: tokIn.code,
          }),
        /inválido o ya fue utilizado/i,
      );

      // 7. Happy check-out atomically completes session & releases 1 integer credit
      const tokOut = await mockRepository.issueSessionToken('u-me', {
        sessionId: 'ses-piano-camila',
        phase: 'check_out',
      });
      const checkedOut = await mockRepository.redeemSessionToken('u-camila', {
        sessionId: 'ses-piano-camila',
        phase: 'check_out',
        code: tokOut.code,
      });
      assert.equal(checkedOut.session.state, 'completed');
      assert.equal(checkedOut.releasedCredits, 1);

      const after = await mockRepository.getWallet('u-me');
      assert.equal(after.available, before.available + 1);
      assert.equal(after.incomingPending, 0);
      assert.equal((await mockRepository.getLedgerIntegrity('u-me')).healthy, true);
    });
  });

  it('Enforces 48h late-cancel disputes, window expiry, non-reopening finalized sessions, and resolveDispute splice safety', async () => {
    await withCleanMockState(async () => {
      assert.equal(SAFETY_POLICY_CONSTANTS.objectionWindowHours, 48);

      // 1. Cannot object on completed, cancelled-timely, confirmed, declined, or disputed/resolved sessions
      await assert.rejects(
        () =>
          mockRepository.submitCancellationObjection('u-me', {
            sessionId: 'ses-english-diego', // completed
            reason: 'Intento inválido sobre sesión completada',
          }),
        /ventana de revisión de 48 h/i,
      );
      await assert.rejects(
        () =>
          mockRepository.submitCancellationObjection('u-me', {
            sessionId: 'ses-yoga', // timely cancelled (no late_review_window)
            reason: 'Intento inválido sobre cancelación a término',
          }),
        /ventana de revisión de 48 h/i,
      );
      await assert.rejects(
        () =>
          mockRepository.submitCancellationObjection('u-me', {
            sessionId: 'ses-karate', // confirmed
            reason: 'Intento inválido sobre sesión confirmada',
          }),
        /ventana de revisión de 48 h/i,
      );

      // 2. Late cancel keeps escrow held without automatic penalty
      const lateCancel = await mockRepository.cancelSession('u-me', {
        sessionId: 'ses-karate',
        reason: 'Lluvia intensa en el barrio',
        simulateLateWindow: true,
      });
      assert.equal(lateCancel.session.state, 'cancelled');
      assert.equal(lateCancel.session.cancellationTiming, 'late_review_window');

      // 3. Expired 48h window rejects objection
      const sesIdx = mockData.sessions.findIndex((s) => s.id === 'ses-karate');
      const validWindowEnd = mockData.sessions[sesIdx].reviewWindowEndsAt;
      mockData.sessions[sesIdx] = {
        ...mockData.sessions[sesIdx],
        reviewWindowEndsAt: new Date(Date.now() - 60_000).toISOString(),
      };
      await assert.rejects(
        () =>
          mockRepository.submitCancellationObjection('u-me', {
            sessionId: 'ses-karate',
            reason: 'Descargo fuera de término después de 48 h',
          }),
        /ya venció/i,
      );
      mockData.sessions[sesIdx] = {
        ...mockData.sessions[sesIdx],
        reviewWindowEndsAt: validWindowEnd,
      };

      // 4. Valid objection opens dispute; duplicate objection is blocked
      const disputed = await mockRepository.submitCancellationObjection('u-me', {
        sessionId: 'ses-karate',
        reason: 'Corte de luz generalizado en Santo Tomás',
      });
      assert.equal(disputed.state, 'disputed');
      await assert.rejects(
        () =>
          mockRepository.submitCancellationObjection('u-me', {
            sessionId: 'ses-karate',
            reason: 'Segundo intento duplicado de descargo',
          }),
        /ya existe un reclamo/i,
      );

      // 5. Synthetic dual pending hold + release entries in resolveDispute splice cleanly
      mockData.ledger.push({
        id: 'tx-synth-dual-rel',
        type: 'release',
        amount: 1,
        sessionId: 'ses-karate',
        idempotencyKey: 'release:ses-karate:synth',
        memo: 'Synthetic pending release for splice test',
        createdAt: new Date().toISOString(),
        status: 'pending',
      });
      const openDispute = (await mockRepository.listDisputes()).find(
        (d) => d.sessionId === 'ses-karate' && d.status === 'open',
      );
      assert.ok(openDispute);

      const resolved = await mockRepository.resolveDispute('u-lucia', {
        disputeId: openDispute.id,
        resolution: 'resolved_refund',
        resolutionNote: 'Fuerza mayor verificada: reintegro del 100%.',
      });
      assert.equal(resolved.status, 'resolved_refund');
      assert.equal(
        mockData.ledger.some((e) => e.id === 'tx-synth-dual-rel'),
        false,
        'resolveDispute must splice pending release entry at refreshed index after unshift',
      );
      assert.equal((await mockRepository.getLedgerIntegrity('u-me')).healthy, true);

      // 6. Resolved session cannot be reopened via submitCancellationObjection
      await assert.rejects(
        () =>
          mockRepository.submitCancellationObjection('u-me', {
            sessionId: 'ses-karate',
            reason: 'Intento de reabrir sesión ya resuelta',
          }),
        /ventana de revisión de 48 h/i,
      );
    });
  });

  it('Enforces verified-only and single-review-per-session rules', async () => {
    await withCleanMockState(async () => {
      await assert.rejects(
        () =>
          mockRepository.submitReview('u-me', {
            sessionId: 'ses-karate',
            rating: 5,
            comment: 'No debería aceptarse antes de completar.',
          }),
        /completadas y verificadas/i,
      );

      // u-me already has a completed session 'ses-python' without a review from u-me? Let's check:
      // In mocks/data.ts, r-2 is on ses-python by u-me; test duplicate rejection on ses-python:
      await assert.rejects(
        () =>
          mockRepository.submitReview('u-me', {
            sessionId: 'ses-python',
            rating: 5,
            comment: 'Intento duplicado de reseña.',
          }),
        /ya publicaste una reseña/i,
      );
    });
  });

  it('Hardens Supabase SQL migration 000007 without standalone invite code or monetary tokens', () => {
    const migrationPath = path.join(
      ROOT_DIR,
      'supabase',
      'migrations',
      '20261125000007_safety_invariants_hardening.sql',
    );
    assert.equal(fs.existsSync(migrationPath), true, 'Migration 000007 must exist');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.equal(/(?<!\d)1234(?!\d)/.test(sql), false, 'Standalone invite code must not appear in 000007');
    assert.equal(/\bARS\b|monetary|resolved_split/i.test(sql), false, 'No monetary/ARS/resolved_split tokens in 000007');

    assert.match(sql, /create or replace function public\.submit_eligibility/i);
    assert.match(sql, /create or replace function public\.guard_profiles_neighborhood_fields/i);
    assert.match(sql, /create or replace function public\.verify_neighborhood_access/i);
    assert.match(sql, /if not found then/i);
    assert.match(sql, /activities_public_meeting_area_check/i);
    assert.match(sql, /create or replace function public\.publish_activity_with_arrangement/i);
    assert.match(sql, /create unique index if not exists disputes_one_open_per_session_uidx/i);
    assert.match(sql, /create or replace function public\.submit_cancellation_objection/i);
    assert.match(sql, /create or replace function public\.resolve_dispute/i);
  });
});
