import { describe, expect, it } from 'vitest';
import {
  activeEmailChallengeKey,
  digestEmailOtp,
  emailOtpMatches,
  generateEmailOtp,
  normalizeEmail,
} from '../src/module/user/email-verification-code';

describe('email verification code ownership', () => {
  it('generates fixed-width cryptographic OTPs and hashes them with context', () => {
    for (let index = 0; index < 100; index += 1)
      expect(generateEmailOtp()).toMatch(/^\d{6}$/u);
    const digest = digestEmailOtp(
      'test-only-pepper-with-enough-entropy',
      'challenge-a',
      'register',
      'owner@example.com',
      '000123',
    );
    expect(digest).toMatch(/^[0-9a-f]{64}$/u);
    expect(digest).not.toContain('000123');
    expect(
      digestEmailOtp(
        'test-only-pepper-with-enough-entropy',
        'challenge-b',
        'register',
        'owner@example.com',
        '000123',
      ),
    ).not.toBe(digest);
    expect(emailOtpMatches(digest, digest)).toBe(true);
    expect(emailOtpMatches(digest, 'not-a-digest')).toBe(false);
    expect(normalizeEmail(' Owner@Example.COM ')).toBe('owner@example.com');
    expect(activeEmailChallengeKey('register', 'owner@example.com')).not.toBe(
      activeEmailChallengeKey('change_email', 'owner@example.com', 7),
    );
  });
});
