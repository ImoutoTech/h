import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { CreateUserDto } from '@/dto/user/create-user.dto';
import { UpdatePasswordDto } from '@/dto/user/update-password.dto';
import { VerifyEmailVerificationChallengeDto } from '@/dto/user/email-verification.dto';
import { UpdateUserDto } from '@/dto/user/update-user.dto';
import { normalizeEmail } from '@/utils/email';
import { EmailNotificationService } from '@/module/user/email-notification.service';
import { EmailVerificationPurpose } from '@/entity/email-verification-purpose';
import { SsoEmailVerification1787100000000 } from '@/database/migrations/1787100000000-SsoEmailVerification';
import { UnifiedNotificationService1786464000000 } from '@/database/migrations/1786464000000-UnifiedNotificationService';

describe('SSO email verification contracts', () => {
  it('normalizes all account email comparisons consistently', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com');
  });

  it('requires a UUID proof for registration and password changes', async () => {
    const registration = Object.assign(new CreateUserDto(), {
      nickname: 'alice',
      email: 'alice@example.com',
      password: 'transport-hash',
    });
    const passwordChange = Object.assign(new UpdatePasswordDto(), {
      newVal: 'transport-hash',
    });
    expect(
      (await validate(registration)).map((error) => error.property),
    ).toContain('verificationProof');
    expect(
      (await validate(passwordChange)).map((error) => error.property),
    ).toContain('verificationProof');
  });

  it('accepts only a six-digit verification code', async () => {
    const invalid = Object.assign(new VerifyEmailVerificationChallengeDto(), {
      code: 'abc123',
    });
    const valid = Object.assign(new VerifyEmailVerificationChallengeDto(), {
      code: '012345',
    });
    expect(await validate(invalid)).not.toHaveLength(0);
    expect(await validate(valid)).toHaveLength(0);
  });

  it('does not expose email as a generic profile update field', () => {
    const update: UpdateUserDto = { nickname: 'Alice' };
    expect('email' in update).toBe(false);
  });

  it('submits OTP mail through the internal notification application contract', async () => {
    const submit = vi.fn().mockResolvedValue({ notificationId: 'notice-id' });
    const service = new EmailNotificationService({ submit } as any);
    const expiresAt = new Date('2026-08-19T12:00:00.000Z');
    await service.sendVerificationCode({
      challengeId: '78d84963-3a77-4bc4-a00d-21d2198999fa',
      email: 'alice@example.com',
      code: '012345',
      purpose: EmailVerificationPurpose.REGISTER,
      expiresAt,
    });
    expect(submit).toHaveBeenCalledWith({
      caller: { kind: 'internal', name: 'sso-email-verification' },
      recipients: [{ kind: 'email', email: 'alice@example.com' }],
      content: {
        kind: 'template',
        templateKey: 'account.email.verify',
        variables: {
          code: '012345',
          purpose: 'register',
          expiresAt: expiresAt.toISOString(),
        },
      },
      idempotencyKey: '78d84963-3a77-4bc4-a00d-21d2198999fa',
    });
  });

  it('orders the notification schema before SSO and seeds its required template', async () => {
    const notification = new UnifiedNotificationService1786464000000();
    const sso = new SsoEmailVerification1787100000000();
    expect(Number(notification.name.match(/\d+$/)?.[0])).toBeLessThan(
      Number(sso.name.match(/\d+$/)?.[0]),
    );
    const query = vi.fn().mockResolvedValue(undefined);
    const hasColumn = vi.fn().mockResolvedValue(false);
    await sso.up({ query, hasColumn } as any);
    expect(query.mock.calls.map(([sql]) => sql).join('\n')).toContain(
      'account.email.verify',
    );
    expect(
      query.mock.calls
        .map(([sql]) => String(sql))
        .filter((sql) => sql.startsWith('ALTER TABLE `users` ADD')),
    ).toEqual([
      expect.stringContaining('ADD `email_verified_at`'),
      expect.stringContaining('ADD `email_verification_source`'),
    ]);
  });

  it('reuses both legacy-compatible user verification columns when already present', async () => {
    const migration = new SsoEmailVerification1787100000000();
    const query = vi.fn().mockResolvedValue(undefined);
    const hasColumn = vi.fn().mockResolvedValue(true);

    await migration.up({ query, hasColumn } as any);

    expect(hasColumn).toHaveBeenCalledWith('users', 'email_verified_at');
    expect(hasColumn).toHaveBeenCalledWith(
      'users',
      'email_verification_source',
    );
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(
      statements.filter((sql) => sql.startsWith('ALTER TABLE `users` ADD')),
    ).toHaveLength(0);
    expect(statements.some((sql) => sql.includes('UPDATE `users` SET'))).toBe(
      true,
    );
    const backfill = statements.find((sql) =>
      sql.includes('UPDATE `users` SET'),
    );
    expect(backfill).toContain(
      '`email_verified_at` = COALESCE(`email_verified_at`, CURRENT_TIMESTAMP)',
    );
    expect(backfill).toContain(
      "`email_verification_source` = COALESCE(`email_verification_source`, 'legacy_migration')",
    );
    expect(
      statements.some((sql) =>
        sql.includes('CREATE TABLE `email_verification_challenges`'),
      ),
    ).toBe(true);
  });

  it.each([
    ['email_verified_at', 'email_verification_source'],
    ['email_verification_source', 'email_verified_at'],
  ])(
    'adds only the missing user verification column when %s already exists',
    async (existingColumn, missingColumn) => {
      const migration = new SsoEmailVerification1787100000000();
      const query = vi.fn().mockResolvedValue(undefined);
      const hasColumn = vi.fn(
        async (_table: string, column: string) => column === existingColumn,
      );

      await migration.up({ query, hasColumn } as any);

      const userAlters = query.mock.calls
        .map(([sql]) => String(sql))
        .filter((sql) => sql.startsWith('ALTER TABLE `users` ADD'));
      expect(userAlters).toEqual([
        expect.stringContaining(`ADD \`${missingColumn}\``),
      ]);
      expect(userAlters[0]).not.toContain(`\`${existingColumn}\``);
    },
  );

  it.each([
    [[], []],
    [['email_verification_source'], ['email_verification_source']],
    [['email_verified_at'], ['email_verified_at']],
    [
      ['email_verification_source', 'email_verified_at'],
      ['email_verification_source', 'email_verified_at'],
    ],
  ])(
    'drops exactly the present verification columns during rollback: %j',
    async (presentColumns, expectedDrops) => {
      const migration = new SsoEmailVerification1787100000000();
      const query = vi.fn().mockResolvedValue(undefined);
      const hasColumn = vi.fn(async (_table: string, column: string) =>
        presentColumns.includes(column),
      );

      await migration.down({ query, hasColumn } as any);

      const drops = query.mock.calls
        .map(([sql]) => String(sql))
        .filter((sql) => sql.startsWith('ALTER TABLE `users` DROP COLUMN'));
      expect(drops).toEqual(
        expectedDrops.map(
          (column) => `ALTER TABLE \`users\` DROP COLUMN \`${column}\``,
        ),
      );
    },
  );

  it('propagates unrelated schema inspection and DDL failures', async () => {
    const migration = new SsoEmailVerification1787100000000();
    const inspectionFailure = new Error('metadata permission denied');
    await expect(
      migration.up({
        query: vi.fn().mockResolvedValue(undefined),
        hasColumn: vi.fn().mockRejectedValue(inspectionFailure),
      } as any),
    ).rejects.toBe(inspectionFailure);

    const ddlFailure = new Error('disk full');
    await expect(
      migration.up({
        query: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(ddlFailure),
        hasColumn: vi.fn().mockResolvedValue(false),
      } as any),
    ).rejects.toBe(ddlFailure);
  });
});
