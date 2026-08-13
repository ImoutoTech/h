import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('email verification service and user transactions', () => {
  it('covers expiry, failures, replay, concurrency, cooldown and transactional ownership', () => {
    const result = spawnSync(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        '-r',
        'tsconfig-paths/register',
        'test/support/email-verification-scenarios.ts',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('email verification scenarios passed');
  });
});
