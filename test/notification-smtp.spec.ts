import { describe, expect, it } from 'vitest';
import { SmtpChannelAdapter } from '../src/module/notification/smtp-channel.adapter';

describe('SMTP delivery classification', () => {
  const adapter = new SmtpChannelAdapter({} as any);

  it('retries 4xx and network errors', () => {
    expect(
      adapter.classify(Object.assign(new Error(), { responseCode: 421 })),
    ).toEqual({
      accepted: false,
      retryable: true,
      errorClass: 'smtp_transient',
    });
    expect(
      adapter.classify(Object.assign(new Error(), { code: 'ETIMEDOUT' })),
    ).toEqual({
      accepted: false,
      retryable: true,
      errorClass: 'smtp_transient',
    });
  });

  it('does not retry explicit SMTP 5xx failures', () => {
    expect(
      adapter.classify(Object.assign(new Error(), { responseCode: 550 })),
    ).toEqual({
      accepted: false,
      retryable: false,
      errorClass: 'recipient_rejected',
    });
  });
});
