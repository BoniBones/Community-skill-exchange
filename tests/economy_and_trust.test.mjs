import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { formatCredits } from '../src/lib/format.ts';
import { runEndToEndVerificationSuite, runPilotReadinessAudit } from '../src/lib/pilotAudit.ts';
import * as mockData from '../src/mocks/data.ts';
import { mockRepository, verifyWalletInvariants } from '../src/services/mockRepository.ts';

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

async function withCleanMockState(fn) {
  const snap = {
    profiles: [...mockData.profiles],
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

describe('Community Skill Exchange — CSE-M1 Economy, Trust & Schema Hygiene Suite', () => {
  it('Enforces integer-only non-cashable credits across all mock data before E2E mutations', () => {
    assert.equal(mockData.activities.length, 12);
    for (const activity of mockData.activities) {
      assert.equal(Number.isInteger(activity.creditAmount), true, `${activity.id} must have integer creditAmount`);
      assert.ok(activity.creditAmount >= 1, `${activity.id} creditAmount must be >= 1`);
    }
    const cooking = mockData.activities.find((a) => a.id === 'a-cooking');
    assert.equal(cooking?.creditAmount, 2, '2h cooking session must cost 2 integer credits');

    for (const ses of mockData.sessions) {
      assert.equal(Number.isInteger(ses.creditAmount), true, `${ses.id} must have integer creditAmount`);
      assert.ok(ses.creditAmount >= 1, `${ses.id} creditAmount must be >= 1`);
    }

    for (const entry of mockData.ledger) {
      assert.equal(Number.isInteger(entry.amount), true, `${entry.id} ledger amount must be integer`);
      assert.notEqual(entry.amount, 0, `${entry.id} ledger amount must be non-zero`);
    }

    for (const dispute of mockData.disputes) {
      assert.equal(Number.isInteger(dispute.creditAmount), true, `${dispute.id} dispute creditAmount must be integer`);
      assert.notEqual(dispute.status, 'resolved_split');
    }

    assert.equal('monetaryPayments' in mockData, false, 'monetaryPayments export must be removed');
    assert.equal(formatCredits(1), '1 crédito');
    assert.equal(formatCredits(2), '2 créditos');
    assert.equal(formatCredits(-1), '−1 crédito');
  });

  it('Rejects invalid dispute resolution resolved_split at runtime without mutating state', async () => {
    await withCleanMockState(async () => {
      await mockRepository.cancelSession('u-me', {
        sessionId: 'ses-karate',
        reason: 'Demora de transporte',
        simulateLateWindow: true,
      });
      await mockRepository.submitCancellationObjection('u-me', {
        sessionId: 'ses-karate',
        reason: 'Corte de servicio en la línea del barrio',
      });
      const disputes = await mockRepository.listDisputes();
      const openDispute = disputes.find((d) => d.sessionId === 'ses-karate' && d.status === 'open');
      assert.ok(openDispute, 'Open dispute must exist for ses-karate');

      await assert.rejects(
        () =>
          mockRepository.resolveDispute('u-lucia', {
            disputeId: openDispute.id,
            resolution: /** @type {any} */ ('resolved_split'),
            resolutionNote: 'Intento de división fraccionaria',
          }),
        /resolución de disputa inválida/i,
      );

      const unchanged = (await mockRepository.listDisputes()).find((d) => d.id === openDispute.id);
      assert.equal(unchanged?.status, 'open');
      const ses = mockData.sessions.find((s) => s.id === 'ses-karate');
      assert.equal(ses?.state, 'disputed');
    });
  });

  it('Settles instructor-side dispute (ses-piano-camila / tx-7) cleanly on resolved_release and resolved_refund', async () => {
    await withCleanMockState(async () => {
      const before = await mockRepository.getWallet('u-me');
      assert.equal(before.available, 2);
      assert.equal(before.incomingPending, 1);
      assert.equal(before.earnedTotal, 3);

      await mockRepository.cancelSession('u-camila', {
        sessionId: 'ses-piano-camila',
        reason: 'Imprevisto de último momento',
        simulateLateWindow: true,
      });
      await mockRepository.submitCancellationObjection('u-camila', {
        sessionId: 'ses-piano-camila',
        reason: 'Problema eléctrico en casa que impide asistir',
      });
      const openDispute = (await mockRepository.listDisputes()).find(
        (d) => d.sessionId === 'ses-piano-camila' && d.status === 'open',
      );
      assert.ok(openDispute, 'Open dispute must exist for ses-piano-camila');

      const resolved = await mockRepository.resolveDispute('u-martin', {
        disputeId: openDispute.id,
        resolution: 'resolved_release',
        resolutionNote: 'Corresponde liberar el crédito al instructor.',
      });
      assert.equal(resolved.status, 'resolved_release');

      const after = await mockRepository.getWallet('u-me');
      assert.equal(after.available, before.available + 1);
      assert.equal(after.earnedTotal, before.earnedTotal + 1);
      assert.equal(after.incomingPending, 0);

      const integrity = await mockRepository.getLedgerIntegrity('u-me');
      assert.equal(integrity.healthy, true);
    });

    await withCleanMockState(async () => {
      const before = await mockRepository.getWallet('u-me');
      await mockRepository.cancelSession('u-camila', {
        sessionId: 'ses-piano-camila',
        reason: 'Imprevisto médico',
        simulateLateWindow: true,
      });
      await mockRepository.submitCancellationObjection('u-camila', {
        sessionId: 'ses-piano-camila',
        reason: 'Certificado de urgencia médica presentado',
      });
      const openDispute = (await mockRepository.listDisputes()).find(
        (d) => d.sessionId === 'ses-piano-camila' && d.status === 'open',
      );
      assert.ok(openDispute);

      const resolved = await mockRepository.resolveDispute('u-martin', {
        disputeId: openDispute.id,
        resolution: 'resolved_refund',
        resolutionNote: 'Fuerza mayor verificada: reintegro al estudiante.',
      });
      assert.equal(resolved.status, 'resolved_refund');

      const after = await mockRepository.getWallet('u-me');
      assert.equal(after.available, before.available);
      assert.equal(after.earnedTotal, before.earnedTotal);
      assert.equal(after.incomingPending, 0);
      assert.equal((await mockRepository.getLedgerIntegrity('u-me')).healthy, true);
    });
  });

  it('Normalizes signed -0 to 0 in computeWallet when pending holds are empty', async () => {
    await withCleanMockState(async () => {
      await mockRepository.cancelSession('u-me', {
        sessionId: 'ses-karate',
        reason: 'Reprogramamos con anticipación',
        simulateLateWindow: false,
      });
      await mockRepository.cancelSession('u-me', {
        sessionId: 'ses-photo',
        reason: 'Reprogramamos con anticipación',
        simulateLateWindow: false,
      });

      const wallet = await mockRepository.getWallet('u-me');
      assert.equal(Object.is(wallet.heldInEscrow, -0), false, 'heldInEscrow must never be -0');
      assert.equal(Object.is(wallet.heldInEscrow, 0), true, 'heldInEscrow must be positive 0');
      assert.equal(Object.is(wallet.available, -0), false);
      assert.equal(Object.is(wallet.spentTotal, -0), false);
    });
  });

  it('Executes all 6 end-to-end domain, economy, QR verification, dispute, and safety checks', async () => {
    const results = await runEndToEndVerificationSuite();
    assert.equal(results.length, 6);
    for (const r of results) {
      assert.equal(r.passed, true, `${r.name}: ${r.detail}`);
    }

    const audit = runPilotReadinessAudit({
      ledgerHealthy: true,
      invariantCount: 5,
      passedInvariants: 5,
    });
    assert.equal(audit.readyForPilot, true);
    assert.equal(
      audit.checks.some((c) => c.id === 'integer-non-cashable-credits' && c.passed),
      true,
    );
  });

  it('Rejects fractional, zero, negative, and NaN credits in upsertActivity and accepts integers >= 1', async () => {
    for (const bad of [0.5, 1.5, 0, -1, Number.NaN]) {
      await assert.rejects(
        () =>
          mockRepository.upsertActivity('u-me', {
            skillId: 's-piano',
            title: 'Clase con créditos inválidos',
            description: 'Prueba de rechazo de valores fraccionarios o no positivos.',
            durationMin: 60,
            format: 'in_person',
            meetingArea: 'Plaza de Santo Tomás',
            requirements: 'Ninguno',
            availabilitySummary: 'Sábados 10 h',
            creditAmount: bad,
            status: 'published',
          }),
        /entero mayor o igual a 1/i,
      );
    }

    const created = await mockRepository.upsertActivity('u-me', {
      skillId: 's-piano',
      title: 'Taller de ritmo en grupo',
      description: 'Encuentro práctico de una hora con créditos comunitarios enteros.',
      durationMin: 60,
      format: 'in_person',
      meetingArea: 'Centro cultural de Santo Tomás',
      requirements: 'Ninguno',
      availabilitySummary: 'Sábados 11 h',
      creditAmount: 1,
      status: 'paused',
    });
    assert.equal(created.activity.creditAmount, 1);
  });

  it('Fails verifyWalletInvariants when given fractional ledger entries or fractional session credits', async () => {
    const wallet = await mockRepository.getWallet('u-me');

    const fractionalLedgerReport = verifyWalletInvariants(
      {
        ...wallet,
        entries: [
          ...wallet.entries,
          {
            id: 'tx-bad-fractional',
            type: 'release',
            amount: 1.5,
            memo: 'Fractional entry test',
            createdAt: new Date().toISOString(),
            status: 'posted',
          },
        ],
      },
      mockData.sessions,
    );
    assert.equal(fractionalLedgerReport.healthy, false);
    assert.equal(
      fractionalLedgerReport.invariants.find((i) => i.id === 'integer_only_non_cashable_credits')?.passed,
      false,
    );

    const fractionalSessionReport = verifyWalletInvariants(wallet, [
      ...mockData.sessions,
      {
        id: 'ses-bad-fractional',
        activityId: 'a-math',
        learnerId: 'u-me',
        instructorId: 'u-diego',
        startsAt: '2026-11-30T21:00:00.000Z',
        endsAt: '2026-11-30T22:00:00.000Z',
        state: 'requested',
        creditAmount: 0.5,
      },
    ]);
    assert.equal(fractionalSessionReport.healthy, false);
    assert.equal(
      fractionalSessionReport.invariants.find((i) => i.id === 'integer_only_non_cashable_credits')?.passed,
      false,
    );
  });

  it('Has zero money/ARS/PaymentMode/MonetaryPayment/resolved_split remnants in active src/, SQL migration, and seed.sql', () => {
    const srcFiles = walkFiles(path.join(ROOT_DIR, 'src'));
    const forbiddenSrcPattern =
      /colors\.money|moneySoft|PaymentMode|PaymentArrangement|MonetaryPayment|monetaryPayment|moneyAmountCents|formatARS|formatMoneyCents|formatPayment|paymentModeLabel|useMonetaryPayments|mercadopago|\bARS\b|resolved_split/i;

    for (const filePath of srcFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(forbiddenSrcPattern);
      assert.equal(match, null, `Unexpected money/split token "${match?.[0]}" in ${path.relative(ROOT_DIR, filePath)}`);
    }

    const migrationPath = path.join(ROOT_DIR, 'supabase', 'migrations', '20261125000005_integer_only_credits.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    const lowerSql = migrationSql.toLowerCase();
    const dropPaymentCheckIdx = lowerSql.indexOf('drop constraint if exists payment_arrangement_mode_check');
    const alterCreditIdx = lowerSql.indexOf('alter column credit_amount type integer');
    const updatePaymentArrangementsIdx = lowerSql.indexOf('update public.payment_arrangements');
    assert.ok(dropPaymentCheckIdx >= 0, 'Migration must drop payment_arrangement_mode_check');
    assert.ok(alterCreditIdx >= 0, 'Migration must alter credit_amount to integer');
    assert.ok(
      dropPaymentCheckIdx < alterCreditIdx,
      'drop constraint if exists payment_arrangement_mode_check must precede alter column credit_amount',
    );
    assert.ok(
      updatePaymentArrangementsIdx === -1 || updatePaymentArrangementsIdx > dropPaymentCheckIdx,
      'No update public.payment_arrangements may precede drop constraint if exists payment_arrangement_mode_check',
    );

    const dropSessionsModeIdx = lowerSql.indexOf('drop constraint if exists sessions_price_mode_check');
    const alterSessionsCreditIdx = lowerSql.indexOf('alter column price_credit_amount type integer');
    const updateSessionsIdx = lowerSql.indexOf('update public.sessions');
    assert.ok(dropSessionsModeIdx >= 0, 'Migration must drop sessions_price_mode_check');
    assert.ok(alterSessionsCreditIdx >= 0, 'Migration must alter price_credit_amount to integer');
    assert.ok(
      dropSessionsModeIdx < alterSessionsCreditIdx,
      'drop constraint if exists sessions_price_mode_check must precede alter column price_credit_amount',
    );
    assert.ok(
      updateSessionsIdx === -1 || updateSessionsIdx > dropSessionsModeIdx,
      'No update public.sessions may precede drop constraint if exists sessions_price_mode_check',
    );

    assert.match(migrationSql, /drop table if exists public\.monetary_payments cascade/i);
    assert.match(migrationSql, /drop function if exists public\.report_monetary_payment/i);
    assert.match(migrationSql, /drop function if exists public\.confirm_monetary_payment/i);
    assert.match(migrationSql, /drop column if exists mode/i);
    assert.match(migrationSql, /drop column if exists money_amount_cents/i);
    assert.match(migrationSql, /drop column if exists currency/i);
    assert.match(migrationSql, /drop column if exists price_mode/i);
    assert.match(migrationSql, /drop column if exists price_money_cents/i);
    assert.match(migrationSql, /drop column if exists price_currency/i);
    assert.match(migrationSql, /check \(credit_amount >= 1\)/i);
    assert.match(migrationSql, /check \(is_non_cashable = true\)/i);
    assert.match(migrationSql, /check \(price_credit_amount >= 1\)/i);
    assert.match(migrationSql, /check \(amount >= 1\)/i);
    assert.match(migrationSql, /check \(status in \('open', 'resolved_refund', 'resolved_release'\)\)/i);

    const seedPath = path.join(ROOT_DIR, 'supabase', 'seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    assert.match(seedSql, /insert into public\.neighborhoods \(id, name, centroid_lat, centroid_lng\)/i);
    assert.match(seedSql, /insert into public\.skill_categories \(id, name, icon, color\)/i);
    assert.match(seedSql, /insert into public\.skills \(id, category_id, name\)/i);
    assert.match(seedSql, /insert into public\.credit_accounts \(id, owner_id, kind, balance\)/i);
    assert.equal(/system_mint|name_es|name_en|\bARS\b|monetary/i.test(seedSql), false);
  });
});
