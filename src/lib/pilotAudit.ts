/**
 * Stage 6 Pilot Readiness & Security Audit Runner + Executable E2E Verification Suite.
 * Verifies architectural, economic, privacy, and Expo Go constraints in live runtime
 * as well as in automated CI (`npm test`).
 */
import { CATEGORIES, NEIGHBORHOODS, SKILLS } from '../domain/catalog';
import { mockRepository, SAFETY_POLICY_CONSTANTS } from '../services/mockRepository';
import { config } from './config';
import { formatSessionDate } from './dates';
import { formatCredits } from './format';
import { getActiveLocale, setActiveLocale, t } from './i18n';

export interface PilotAuditCheck {
  id: string;
  category: 'architecture' | 'economy' | 'trust' | 'privacy' | 'i18n';
  title: string;
  passed: boolean;
  detail: string;
}

export interface PilotAuditSummary {
  readyForPilot: boolean;
  passedCount: number;
  totalCount: number;
  checks: PilotAuditCheck[];
}

export function runPilotReadinessAudit(params: {
  ledgerHealthy: boolean;
  invariantCount: number;
  passedInvariants: number;
}): PilotAuditSummary {
  const sampleUtc = '2026-11-10T22:00:00.000Z';
  const formattedBsAs = formatSessionDate(sampleUtc);
  const formattedEsOne = formatCredits(1, 'es-AR');
  const formattedEsTwo = formatCredits(2, 'es-AR');
  const formattedEnOne = formatCredits(1, 'en');
  const formattedEnTwo = formatCredits(2, 'en');

  const checks: PilotAuditCheck[] = [
    {
      id: 'entity-separation',
      category: 'architecture',
      title: t('auditCheck1Title'),
      passed:
        CATEGORIES.length === 7 &&
        SKILLS.length >= 32 &&
        NEIGHBORHOODS.length === 3 &&
        NEIGHBORHOODS.some((n) => n.id === 'n-santo-tomas' && n.isActive) &&
        NEIGHBORHOODS.some((n) => n.id === 'n-pilar' && !n.isActive),
      detail: t('auditCheck1Detail', {
        categories: CATEGORIES.length,
        skills: SKILLS.length,
        neighborhoods: NEIGHBORHOODS.length,
        names: NEIGHBORHOODS.map((n) => n.name).join(', '),
      }),
    },
    {
      id: 'integer-non-cashable-credits',
      category: 'economy',
      title: t('auditCheck2Title'),
      passed:
        SAFETY_POLICY_CONSTANTS.maxBalance === 20 &&
        formattedEsOne === '1 crédito' &&
        formattedEsTwo === '2 créditos' &&
        formattedEnOne === '1 credit' &&
        formattedEnTwo === '2 credits',
      detail: t('auditCheck2Detail', {
        esOne: formattedEsOne,
        enOne: formattedEnOne,
      }),
    },
    {
      id: 'double-entry-invariants',
      category: 'economy',
      title: t('auditCheck3Title'),
      passed: params.ledgerHealthy && params.passedInvariants === params.invariantCount,
      detail: t('auditCheck3Detail', {
        passed: params.passedInvariants,
        total: params.invariantCount,
      }),
    },
    {
      id: 'qr-and-dispute-protection',
      category: 'trust',
      title: t('auditCheck4Title'),
      passed:
        SAFETY_POLICY_CONSTANTS.qrTokenTtlSeconds === 90 &&
        SAFETY_POLICY_CONSTANTS.objectionWindowHours === 48 &&
        SAFETY_POLICY_CONSTANTS.cancellationDeadlineHours === 24,
      detail: t('auditCheck4Detail'),
    },
    {
      id: 'privacy-and-age-gate',
      category: 'privacy',
      title: t('auditCheck5Title'),
      passed:
        !config.supabaseAnonKey.includes('service_role') &&
        SAFETY_POLICY_CONSTANTS.minPilotAge === 18 &&
        SAFETY_POLICY_CONSTANTS.maxBalance === 20,
      detail: t('auditCheck5Detail'),
    },
    {
      id: 'timezone-and-i18n',
      category: 'i18n',
      title: t('auditCheck6Title'),
      passed: config.timeZone === 'America/Argentina/Buenos_Aires' && formattedBsAs.includes('19:00'),
      detail: t('auditCheck6Detail', {
        formatted: formattedBsAs,
        tz: config.timeZone,
      }),
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    readyForPilot: passedCount === checks.length,
    passedCount,
    totalCount: checks.length,
    checks,
  };
}

export interface E2ETestCaseResult {
  name: string;
  passed: boolean;
  detail: string;
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function expectRejects(fn: () => Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  assertCondition(rejected, message);
}

export async function runEndToEndVerificationSuite(): Promise<E2ETestCaseResult[]> {
  const results: E2ETestCaseResult[] = [];

  // 1. Entity separation & neighborhood gate
  const me = await mockRepository.getProfile('u-me');
  assertCondition(!!me, 'Current user profile must exist');
  const offers = me!.skills.filter((s) => s.kind === 'offers');
  const wants = me!.skills.filter((s) => s.kind === 'wants');
  const myActivities = await mockRepository.listActivitiesByInstructor('u-me');
  const neighborhoods = await mockRepository.listNeighborhoods();
  assertCondition(
    CATEGORIES.length === 7 &&
      SKILLS.length >= 32 &&
      offers.length > 0 &&
      wants.length > 0 &&
      myActivities.length >= 2 &&
      neighborhoods.some((n) => n.id === 'n-santo-tomas' && n.isActive) &&
      neighborhoods.some((n) => n.id === 'n-pilar' && !n.isActive),
    'Strict separation between Catalog Skills (>=32 across 7 categories), UserSkills, Activities, and active Santo Tomás neighborhood',
  );
  await expectRejects(
    () => mockRepository.verifyNeighborhoodAccess('u-me', { neighborhoodId: 'n-pilar', accessCode: '0000' }),
    'Inactive neighborhood n-pilar must be rejected',
  );
  results.push({
    name: t('e2eCheck1Name'),
    passed: true,
    detail: t('e2eCheck1Detail', {
      offers: offers.length,
      wants: wants.length,
      activities: myActivities.length,
    }),
  });

  // 2. Integer-only non-cashable credits (1h = 1 credit) & MAX_BALANCE = 20
  const all = await mockRepository.listActivities({});
  const allPositiveIntegers =
    all.length > 0 && all.every((a) => Number.isInteger(a.creditAmount) && a.creditAmount >= 1);
  assertCondition(
    allPositiveIntegers &&
      SAFETY_POLICY_CONSTANTS.maxBalance === 20 &&
      formatCredits(1, 'es-AR') === '1 crédito' &&
      formatCredits(2, 'es-AR') === '2 créditos' &&
      formatCredits(1, 'en') === '1 credit' &&
      formatCredits(2, 'en') === '2 credits',
    'All activities must use integer credits >= 1 with MAX_BALANCE === 20 and no decimals',
  );

  for (const invalidAmount of [1.5, 0, -1]) {
    await expectRejects(
      () =>
        mockRepository.upsertActivity('u-me', {
          skillId: 's-piano',
          title: 'Clase de prueba inválida',
          description: 'Validación de créditos enteros únicamente en el repositorio.',
          durationMin: 60,
          format: 'in_person',
          meetingArea: 'Plaza de Santo Tomás',
          requirements: 'Ninguno',
          availabilitySummary: 'Sábados 10 h',
          creditAmount: invalidAmount,
          status: 'published',
        }),
      `upsertActivity must reject invalid creditAmount=${invalidAmount}`,
    );
  }

  results.push({
    name: t('e2eCheck2Name'),
    passed: true,
    detail: t('e2eCheck2Detail', { count: all.length }),
  });

  // 3. Double-entry credit ledger & timely cancellation
  const beforeWallet = await mockRepository.getWallet('u-me');
  assertCondition(beforeWallet.maxBalance === 20, 'Wallet maxBalance cap must be 20');
  const session = await mockRepository.requestSession('u-me', {
    activityId: 'a-math',
    startsAt: '2026-11-28T21:00:00.000Z',
    learnerNote: 'Necesito repasar funciones cuadráticas.',
  });
  const afterHoldWallet = await mockRepository.getWallet('u-me');
  assertCondition(
    Number.isInteger(afterHoldWallet.available) &&
      Number.isInteger(afterHoldWallet.heldInEscrow) &&
      afterHoldWallet.available === beforeWallet.available - 1 &&
      afterHoldWallet.heldInEscrow === beforeWallet.heldInEscrow + 1,
    'Escrow reservation holds 1 integer credit',
  );
  const cancelResult = await mockRepository.cancelSession('u-me', {
    sessionId: session.id,
    reason: 'Reprogramamos para la semana que viene',
    simulateLateWindow: false,
  });
  const afterRefundWallet = await mockRepository.getWallet('u-me');
  assertCondition(
    cancelResult.session.cancellationTiming === 'timely' && afterRefundWallet.available === beforeWallet.available,
    'Timely cancellation (>24h) refunds 100% from escrow',
  );
  results.push({
    name: t('e2eCheck3Name'),
    passed: true,
    detail: t('e2eCheck3Detail', { available: formatCredits(afterRefundWallet.available) }),
  });

  // 4. Late cancellation (<24h) 48h force-majeure window & moderator dispute resolution
  const lateSession = await mockRepository.requestSession('u-me', {
    activityId: 'a-math',
    startsAt: '2026-11-29T21:00:00.000Z',
  });
  const lateCancel = await mockRepository.cancelSession('u-me', {
    sessionId: lateSession.id,
    reason: 'Corte de luz en el barrio',
    simulateLateWindow: true,
  });
  assertCondition(
    lateCancel.session.cancellationTiming === 'late_review_window',
    'Late cancellation enters 48h review window without automatic penalty',
  );
  const disputedSession = await mockRepository.submitCancellationObjection('u-me', {
    sessionId: lateSession.id,
    reason: 'Tormenta fuerte e inundación en Santo Tomás',
  });
  assertCondition(disputedSession.state === 'disputed', 'Session enters disputed state on objection');
  const disputes = await mockRepository.listDisputes();
  const openDispute = disputes.find((d) => d.sessionId === lateSession.id);
  assertCondition(!!openDispute, 'Dispute appears in moderation queue');
  const resolved = await mockRepository.resolveDispute('u-me', {
    disputeId: openDispute!.id,
    resolution: 'resolved_refund',
    resolutionNote: 'Fuerza mayor climática verificada: reintegro del 100% al estudiante.',
  });
  assertCondition(resolved.status === 'resolved_refund', 'Moderator resolves dispute with 100% refund');
  await expectRejects(
    () =>
      mockRepository.submitCancellationObjection('u-me', {
        sessionId: 'ses-english-diego',
        reason: 'Intento de reabrir sesión ya completada',
      }),
    'Cannot reopen a completed session via submitCancellationObjection',
  );
  await expectRejects(
    () =>
      mockRepository.submitCancellationObjection('u-me', {
        sessionId: lateSession.id,
        reason: 'Intento de reabrir sesión ya resuelta',
      }),
    'Cannot reopen a resolved session via submitCancellationObjection',
  );
  results.push({
    name: t('e2eCheck4Name'),
    passed: true,
    detail: t('e2eCheck4Detail', { id: resolved.id }),
  });

  // 5. Two-stage dynamic QR verification (check_in + check_out) & verified review
  const walletBeforeQr = await mockRepository.getWallet('u-me');
  const checkInToken = await mockRepository.issueSessionToken('u-me', {
    sessionId: 'ses-piano-camila',
    phase: 'check_in',
  });
  await expectRejects(
    () =>
      mockRepository.redeemSessionToken('u-camila', {
        sessionId: 'ses-piano-camila',
        phase: 'check_in',
        code: 'ZZZZZZ',
      }),
    'Bogus QR code must be rejected',
  );
  await expectRejects(
    () =>
      mockRepository.redeemSessionToken('u-me', {
        sessionId: 'ses-piano-camila',
        phase: 'check_in',
        code: checkInToken.code,
      }),
    'Issuer cannot self-redeem own QR code',
  );
  const afterCheckIn = await mockRepository.redeemSessionToken('u-camila', {
    sessionId: 'ses-piano-camila',
    phase: 'check_in',
    code: checkInToken.code,
  });
  assertCondition(
    afterCheckIn.session.state === 'in_progress' && afterCheckIn.releasedCredits === 0,
    'Check-in transitions to in_progress without premature credit release',
  );
  await expectRejects(
    () =>
      mockRepository.redeemSessionToken('u-camila', {
        sessionId: 'ses-piano-camila',
        phase: 'check_in',
        code: checkInToken.code,
      }),
    'Single-use QR token replay must be rejected',
  );
  const checkOutToken = await mockRepository.issueSessionToken('u-me', {
    sessionId: 'ses-piano-camila',
    phase: 'check_out',
  });
  const afterCheckOut = await mockRepository.redeemSessionToken('u-camila', {
    sessionId: 'ses-piano-camila',
    phase: 'check_out',
    code: checkOutToken.code,
  });
  const walletAfterQr = await mockRepository.getWallet('u-me');
  assertCondition(
    afterCheckOut.session.state === 'completed' &&
      afterCheckOut.releasedCredits === 1 &&
      Number.isInteger(walletAfterQr.available) &&
      walletAfterQr.available === walletBeforeQr.available + 1,
    'Check-out completes session and atomically releases 1 integer credit to instructor',
  );
  await expectRejects(
    () =>
      mockRepository.submitReview('u-me', {
        sessionId: 'ses-karate',
        rating: 5,
        comment: 'No debería permitir reseña en sesión sin completar.',
      }),
    'Reviews on non-completed sessions must be rejected',
  );
  const review = await mockRepository.submitReview('u-me', {
    sessionId: 'ses-piano-camila',
    rating: 5,
    comment: 'Camila aprendió su primera melodía completa en la primera clase.',
  });
  assertCondition(review.rating === 5, 'Verified review recorded for completed session');
  await expectRejects(
    () =>
      mockRepository.submitReview('u-me', {
        sessionId: 'ses-piano-camila',
        rating: 4,
        comment: 'Intento de reseña duplicada para la misma sesión.',
      }),
    'Duplicate reviews for the same session must be rejected',
  );
  results.push({
    name: t('e2eCheck5Name'),
    passed: true,
    detail: t('e2eCheck5Detail'),
  });

  // 6. 18+ age gate, public meeting points, safety blocking, i18n, and ledger invariants
  const currentYear = new Date().getUTCFullYear();
  await expectRejects(
    () =>
      mockRepository.submitEligibility('u-me', {
        birthYear: 1996,
        birthMonth: 2,
        birthDay: 30,
        acceptedSafetyRules: true,
      }),
    'Invalid calendar date (1996-02-30) must be rejected',
  );
  const uncheckedRules = await mockRepository.submitEligibility('u-me', {
    birthYear: currentYear - 25,
    birthMonth: 1,
    birthDay: 15,
    acceptedSafetyRules: false,
  });
  assertCondition(!uncheckedRules.eligible && uncheckedRules.status === 'pending_eligibility', 'Unchecked safety rules rejected');
  const under13 = await mockRepository.submitEligibility('u-me', {
    birthYear: currentYear - 10,
    birthMonth: 1,
    birthDay: 15,
    acceptedSafetyRules: true,
  });
  assertCondition(!under13.eligible && under13.status === 'restricted', 'Under 13 rejected');
  const minor15 = await mockRepository.submitEligibility('u-me', {
    birthYear: currentYear - 15,
    birthMonth: 1,
    birthDay: 15,
    acceptedSafetyRules: true,
    guardianEmail: 'tutor@ejemplo.com',
  });
  assertCondition(!minor15.eligible && minor15.status === 'restricted', '13-17 restricted in pilot');
  const adult = await mockRepository.submitEligibility('u-me', {
    birthYear: currentYear - 25,
    birthMonth: 1,
    birthDay: 15,
    acceptedSafetyRules: true,
  });
  assertCondition(adult.eligible && adult.status === 'active', '18+ restores active status');

  await expectRejects(
    () =>
      mockRepository.upsertActivity('u-me', {
        skillId: 's-piano',
        title: 'Clase privada en domicilio',
        description: 'Esta actividad debe rechazarse por exponer domicilio privado.',
        durationMin: 60,
        format: 'in_person',
        meetingArea: 'Mi casa en calle falsa 123',
        requirements: 'Ninguno',
        availabilitySummary: 'Sábados 10 h',
        creditAmount: 1,
        status: 'published',
      }),
    'Private home address in meetingArea must be rejected',
  );

  await mockRepository.reportOrBlockUser('u-me', {
    targetUserId: 'u-rosa',
    reason: 'Prueba de bloqueo preventivo',
    blockUser: true,
  });
  const visibleActivities = await mockRepository.listActivities({});
  assertCondition(
    !visibleActivities.some((a) => a.instructorId === 'u-rosa'),
    'Blocked user activities are hidden from discovery',
  );
  const prevLocale = getActiveLocale();
  try {
    setActiveLocale('es-AR');
    assertCondition(t('communityTagline').includes('enseñar'), 'es-AR active');
    setActiveLocale('en');
    assertCondition(t('communityTagline').includes('teach'), 'English translation active');
  } finally {
    setActiveLocale(prevLocale);
  }

  const finalIntegrity = await mockRepository.getLedgerIntegrity('u-me');
  assertCondition(finalIntegrity.healthy, 'All 5 double-entry invariants remain healthy after full E2E run');
  results.push({
    name: t('e2eCheck6Name'),
    passed: true,
    detail: t('e2eCheck6Detail'),
  });

  return results;
}
