import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('ExternalIdentityService Google callback', () => {
  it('validates the returned state while preserving PKCE and nonce checks', () => {
    const script = `
      require('reflect-metadata');
      const assert = require('node:assert/strict');
      const importer = require('./src/module/oauth/native-import');
      let grantArguments;
      importer.nativeImport = async () => ({
        discovery: async () => ({ issuer: 'google' }),
        authorizationCodeGrant: async (...args) => {
          grantArguments = args;
          return { claims: () => ({ sub: 'google-user', email_verified: false }) };
        },
      });
      const { ExternalIdentityService } = require('./src/module/identity/external-identity.service');
      const transaction = {
        provider: 'google',
        verifier: 'pkce-verifier',
        nonce: 'expected-nonce',
      };
      const service = new ExternalIdentityService(
        { credentials: async () => ({ clientId: 'google-client', clientSecret: 'google-secret' }) },
        { get: () => 'https://identity.example' },
        {},
        {},
        { consume: async () => transaction },
      );
      service.logger = { warn() {} };
      service.callback(
        'google',
        'authorization-code',
        'callback-state',
        undefined,
        'https://accounts.google.com',
      ).then(() => {
        const [, currentUrl, checks] = grantArguments;
        assert.equal(
          currentUrl.toString(),
          'https://identity.example/external/google/callback?code=authorization-code&state=callback-state&iss=https%3A%2F%2Faccounts.google.com',
        );
        assert.deepEqual(checks, {
          pkceCodeVerifier: 'pkce-verifier',
          expectedNonce: 'expected-nonce',
          expectedState: 'callback-state',
        });
        process.stdout.write('google callback checks preserved\\n');
      }).catch((error) => { console.error(error); process.exit(1); });
    `;
    const result = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', '-e', script],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('google callback checks preserved');
  });
});
