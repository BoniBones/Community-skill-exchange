import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runEndToEndVerificationSuite } from '../src/lib/pilotAudit.ts';

describe('Community Skill Exchange — Stage 6 E2E Verification Suite', () => {
  it('Executes all 6 end-to-end domain, economy, QR verification, dispute, and safety checks', async () => {
    const results = await runEndToEndVerificationSuite();
    assert.equal(results.length, 6);
    for (const r of results) {
      assert.equal(r.passed, true, `${r.name}: ${r.detail}`);
    }
  });
});
