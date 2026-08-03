import { describe, expect, it, vi } from 'vitest';
import { IdentityController } from '../src/module/identity/identity.controller';

describe('IdentityController external callback', () => {
  it('uses the current Fastify redirect signature', async () => {
    const identities = {
      callback: vi.fn().mockResolvedValue({ outcome: 'cancelled' }),
      storeResult: vi.fn().mockResolvedValue('opaque-result'),
    };
    const response = { redirect: vi.fn() };
    const controller = new IdentityController(
      identities as any,
      {} as any,
      {
        get: vi.fn().mockReturnValue('https://safe.example'),
      } as any,
    );

    await controller.callback(
      'google',
      {
        state: 'callback-state',
        error: 'access_denied',
        iss: 'https://accounts.google.com',
      },
      response,
    );

    expect(identities.callback).toHaveBeenCalledWith(
      'google',
      undefined,
      'callback-state',
      'access_denied',
      'https://accounts.google.com',
    );

    expect(response.redirect).toHaveBeenCalledWith(
      'https://safe.example/external/callback?result=opaque-result',
      302,
    );
  });
});
