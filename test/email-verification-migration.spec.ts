import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { EmailVerificationOwnership1786377600000 } from '../src/database/migrations/1786377600000-EmailVerificationOwnership';

describe('email verification ownership migration', () => {
  it('uses a fixed legacy fact timestamp and MySQL 5.7-compatible schema', async () => {
    const calls: Array<{ sql: string; parameters?: unknown[] }> = [];
    const query = vi.fn(async (sql: string, parameters?: unknown[]) => {
      calls.push({ sql, parameters });
      if (sql.includes('information_schema.COLUMNS')) return [];
      if (sql.includes('information_schema.TABLES')) return [];
      return [];
    });
    await new EmailVerificationOwnership1786377600000().up({ query } as never);
    const backfill = calls.find((call) =>
      call.sql.startsWith('UPDATE `users` SET `email_verified_at`'),
    );
    expect(backfill?.parameters).toEqual([
      '2026-08-10 00:00:00.000000',
      'legacy_migration',
    ]);
    const create = calls.find((call) =>
      call.sql.startsWith('CREATE TABLE `email_verification_challenges`'),
    )?.sql;
    expect(create).toContain('ENGINE=InnoDB');
    expect(create).toContain('`code_hash` char(64)');
    expect(create).toContain(
      'UNIQUE KEY `uq_email_challenge_active_key` (`active_key`)',
    );
    expect(create).not.toMatch(/\bCHECK\b|WHERE\s+.*INDEX/iu);
  });

  it('guards rollback before DDL and preserves user verification facts', () => {
    const source = readFileSync(
      'src/database/migrations/1786377600000-EmailVerificationOwnership.ts',
      'utf8',
    );
    const down = source.slice(source.indexOf('async down'));
    expect(down.indexOf('SELECT `id`')).toBeLessThan(
      down.indexOf('DROP TABLE `email_verification_challenges`'),
    );
    expect(down).not.toContain('DROP COLUMN `email_verified_at`');
    expect(down).not.toContain('DROP COLUMN `email_verification_source`');
  });

  it('refuses to destroy any historical challenge records', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('information_schema.TABLES'))
        return [{ TABLE_NAME: 'email_verification_challenges' }];
      if (sql.startsWith('SELECT `id`')) return [{ id: 'fact' }];
      throw new Error('DDL must not run');
    });
    await expect(
      new EmailVerificationOwnership1786377600000().down({ query } as never),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalledWith(
      'DROP TABLE `email_verification_challenges`',
    );
  });
});
