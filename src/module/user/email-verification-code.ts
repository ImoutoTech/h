import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import type { EmailVerificationPurpose } from '@/entity';

const OTP_SPACE = 1_000_000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateEmailOtp(): string {
  return randomInt(0, OTP_SPACE).toString().padStart(6, '0');
}

export function activeEmailChallengeKey(
  purpose: EmailVerificationPurpose,
  normalizedEmail: string,
  userId?: number,
): string {
  return createHash('sha256')
    .update(JSON.stringify([purpose, normalizedEmail, userId ?? null]), 'utf8')
    .digest('hex');
}

export function digestEmailOtp(
  pepper: string,
  challengeId: string,
  purpose: EmailVerificationPurpose,
  normalizedEmail: string,
  code: string,
): string {
  if (!pepper) throw new Error('EMAIL_VERIFICATION_PEPPER is required');
  return createHmac('sha256', pepper)
    .update(
      JSON.stringify([challengeId, purpose, normalizedEmail, code]),
      'utf8',
    )
    .digest('hex');
}

export function emailOtpMatches(
  expectedHex: string,
  actualHex: string,
): boolean {
  if (!/^[0-9a-f]{64}$/u.test(expectedHex)) return false;
  if (!/^[0-9a-f]{64}$/u.test(actualHex)) return false;
  return timingSafeEqual(
    Buffer.from(expectedHex, 'hex'),
    Buffer.from(actualHex, 'hex'),
  );
}
