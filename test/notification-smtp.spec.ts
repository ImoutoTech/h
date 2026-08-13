import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SmtpChannelAdapter } from '../src/module/notification/smtp-channel.adapter';

const { close, createTransport, sendMail } = vi.hoisted(() => ({
  close: vi.fn(),
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({ createTransport }));

describe('SMTP delivery classification', () => {
  const adapter = new SmtpChannelAdapter({} as any);

  beforeEach(() => {
    close.mockReset();
    sendMail.mockReset().mockResolvedValue({ accepted: ['user@example.com'] });
    createTransport.mockReset().mockReturnValue({ close, sendMail });
  });

  it('sends email when SMTP credentials are available', async () => {
    const deliveryAdapter = new SmtpChannelAdapter({
      credentials: vi.fn().mockResolvedValue({
        host: 'smtp.example.com',
        port: 587,
        tlsMode: 'starttls',
        username: 'mailer',
        password: 'secret',
        fromName: 'Example',
        fromAddress: 'no-reply@example.com',
      }),
    } as any);

    await expect(
      deliveryAdapter.send({
        to: 'user@example.com',
        subject: 'Welcome',
        text: 'Hello',
      }),
    ).resolves.toEqual({ accepted: true });
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: 'Example', address: 'no-reply@example.com' },
      to: 'user@example.com',
      subject: 'Welcome',
      text: 'Hello',
      html: undefined,
    });
    expect(close).toHaveBeenCalledOnce();
  });

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
