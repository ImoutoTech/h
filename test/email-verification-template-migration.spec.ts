import { describe, expect, it, vi } from 'vitest';
import {
  EMAIL_VERIFICATION_TEMPLATE_HTML,
  EMAIL_VERIFICATION_TEMPLATE_KEY,
  EmailVerificationHtmlTemplate1787184000000,
} from '@/database/migrations/1787184000000-EmailVerificationHtmlTemplate';
import { SsoEmailVerification1787100000000 } from '@/database/migrations/1787100000000-SsoEmailVerification';
import { TemplateRenderer } from '@/module/notification/template-renderer';

describe('email verification HTML template migration', () => {
  it('runs after the email verification template seed', () => {
    const seed = new SsoEmailVerification1787100000000();
    const html = new EmailVerificationHtmlTemplate1787184000000();

    expect(Number(seed.name.match(/\d+$/)?.[0])).toBeLessThan(
      Number(html.name.match(/\d+$/)?.[0]),
    );
  });

  it('fills only the empty HTML field of the fixed template', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new EmailVerificationHtmlTemplate1787184000000();

    await migration.up({ query } as any);

    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      'UPDATE `notification_templates` SET `html` = ? WHERE `key` = ? AND `html` IS NULL',
      [EMAIL_VERIFICATION_TEMPLATE_HTML, EMAIL_VERIFICATION_TEMPLATE_KEY],
    );
  });

  it('removes only its unchanged default HTML during rollback', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new EmailVerificationHtmlTemplate1787184000000();

    await migration.down({ query } as any);

    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      'UPDATE `notification_templates` SET `html` = NULL WHERE `key` = ? AND BINARY `html` = BINARY ?',
      [EMAIL_VERIFICATION_TEMPLATE_KEY, EMAIL_VERIFICATION_TEMPLATE_HTML],
    );
  });

  it('renders the complete variable contract and keeps email-safe layout styles', () => {
    const renderer = new TemplateRenderer();
    const allowedVariables = ['code', 'purpose', 'expiresAt'];
    const referencedVariables = renderer.references(
      EMAIL_VERIFICATION_TEMPLATE_HTML,
    );

    expect([...referencedVariables].sort()).toEqual(
      [...allowedVariables].sort(),
    );
    expect(() =>
      renderer.validate(
        '邮箱验证码',
        '您的验证码是 {{code}}。用途：{{purpose}}。过期时间：{{expiresAt}}。',
        EMAIL_VERIFICATION_TEMPLATE_HTML,
        allowedVariables,
      ),
    ).not.toThrow();

    const result = renderer.render(
      {
        subject: '邮箱验证码',
        text: '您的验证码是 {{code}}。用途：{{purpose}}。过期时间：{{expiresAt}}。',
        html: EMAIL_VERIFICATION_TEMPLATE_HTML,
        allowedVariables,
      },
      {
        code: '012345',
        purpose: 'register',
        expiresAt: '2026-08-20T02:00:00.000Z',
      },
    );

    expect(result.subject).toBe('邮箱验证码');
    expect(result.text).toBe(
      '您的验证码是 012345。用途：register。过期时间：2026-08-20T02:00:00.000Z。',
    );
    expect(result.html).toContain('#08736a');
    expect(result.html).toContain('@media only screen and (max-width: 480px)');
    expect(result.html).toContain(
      'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"',
    );
    expect(result.html).toContain(
      'class="email-card" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"',
    );
    expect(result.html).toContain('width: 100%; max-width: 600px');
    expect(result.html).toContain('white-space: nowrap');
    expect(result.html).toContain('012345');
    expect(result.html).toContain('register');
    expect(result.html).toContain('2026-08-20T02:00:00.000Z');
    expect(result.html).not.toMatch(
      /<(?:script|iframe|form|input|button|img|link)\b/i,
    );
    expect(result.html).not.toMatch(/\b(?:src|href)=/i);
  });
});
