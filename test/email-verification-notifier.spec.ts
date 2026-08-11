import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailVerificationNotifier } from '../src/module/user/email-verification-notifier';

const configuration = {
  NOTIFICATION_API_URL: 'https://notification.example.test',
  OIDC_ISSUER: 'https://identity.example.test/oidc',
  NOTIFICATION_CLIENT_ID: 'h-account-email',
  NOTIFICATION_CLIENT_SECRET: 'test-client-secret',
};

function createNotifier() {
  return new EmailVerificationNotifier({
    get(name: keyof typeof configuration) {
      return configuration[name];
    },
  } as never);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('email verification notification client', () => {
  it('uses the notification contract and a stable challenge idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'machine-token', expires_in: 300 }),
          { status: 200 },
        ),
      )
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ notificationId: 'notification-id' }), {
            status: 202,
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const notifier = createNotifier();
    const input = {
      challengeId: '0198b0d0-0000-7000-8000-000000000001',
      email: 'owner@example.com',
      code: '123456',
      expiresAt: new Date('2026-08-11T08:00:00.000Z'),
    };

    await expect(notifier.send(input)).resolves.toBe('notification-id');
    await expect(notifier.send(input)).resolves.toBe('notification-id');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const notificationCalls = fetchMock.mock.calls.slice(1);
    for (const [url, options] of notificationCalls) {
      expect(String(url)).toBe(
        'https://notification.example.test/v1/notifications',
      );
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer machine-token',
        'Idempotency-Key': input.challengeId,
      });
      expect(JSON.parse(String(options.body))).toEqual({
        template: 'account.email.verify',
        recipient: {
          kind: 'address',
          channel: 'email',
          address: input.email,
        },
        variables: { code: input.code },
        expiresAt: input.expiresAt.toISOString(),
      });
    }
    const tokenRequest = fetchMock.mock.calls[0]?.[1];
    expect(String(tokenRequest?.body)).toContain(
      'resource=urn%3Ah%3Aresource%3Anotification-api',
    );
  });

  it('returns a fixed error without disclosing the OTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: 'machine-token', expires_in: 300 }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response('rejected 123456', { status: 400 }),
        ),
    );

    const error = await createNotifier()
      .send({
        challengeId: '0198b0d0-0000-7000-8000-000000000001',
        email: 'owner@example.com',
        code: '123456',
        expiresAt: new Date('2026-08-11T08:00:00.000Z'),
      })
      .catch((reason: Error) => reason);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Email verification notification was rejected');
    expect(error.message).not.toContain('123456');
  });
});
