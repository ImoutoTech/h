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
      service.callback('google', 'authorization-code', 'callback-state').then(() => {
        const [, currentUrl, checks] = grantArguments;
        assert.equal(
          currentUrl.toString(),
          'https://identity.example/external/google/callback?code=authorization-code&state=callback-state',
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

  it('classifies Google failures without logging sensitive exception data', () => {
    const script = `
      require('reflect-metadata');
      const assert = require('node:assert/strict');
      const importer = require('./src/module/oauth/native-import');
      const sensitive = 'SENSITIVE-google-oauth-material';
      let scenario;
      const scenarios = [
        {
          substage: 'authorization_response',
          reason: 'validation_failed',
          code: 'OAUTH_AUTHORIZATION_RESPONSE_ERROR',
          message: 'authorization response state parameter mismatch',
        },
        {
          substage: 'token_response_shape',
          reason: 'invalid_shape',
          code: 'OAUTH_INVALID_RESPONSE',
          message: '\"response\" body \"id_token\" property must be a string',
        },
        {
          substage: 'id_token_signature',
          reason: 'verification_failed',
          code: 'OAUTH_INVALID_RESPONSE',
          message: 'JWT signature verification failed',
        },
        {
          substage: 'id_token_claim',
          reason: 'validation_failed',
          code: 'OAUTH_JWT_CLAIM_COMPARISON_FAILED',
          message: 'unexpected ID Token nonce claim value',
        },
        {
          substage: 'jwks',
          reason: 'key_resolution_failed',
          code: 'OAUTH_KEY_SELECTION_FAILED',
          message: 'error when selecting a JWT verification key',
        },
        {
          substage: 'unknown',
          reason: 'unclassified',
          code: 'UNRECOGNIZED_FAILURE',
          message: 'unrecognized failure',
        },
      ];
      const failure = () => Object.assign(new Error('wrapper ' + sensitive), {
        name: 'ClientError',
        code: scenario.code,
        cause: Object.assign(new Error(scenario.message + ' ' + sensitive), {
          name: 'OperationProcessingError',
          code: scenario.code,
          cause: { name: 'DeepCause', message: sensitive, code: sensitive },
        }),
        error_description: sensitive,
        url: sensitive,
        state: sensitive,
        authorizationCode: sensitive,
        nonce: sensitive,
        verifier: sensitive,
        clientId: sensitive,
        clientSecret: sensitive,
        token: sensitive,
        claims: { email: sensitive },
      });
      importer.nativeImport = async () => ({
        discovery: async () => ({ issuer: 'google' }),
        authorizationCodeGrant: async () => { throw failure(); },
      });
      const { ExternalIdentityService } = require('./src/module/identity/external-identity.service');
      const transaction = {
        provider: 'google',
        verifier: sensitive,
        nonce: sensitive,
      };
      (async () => {
        for (scenario of scenarios) {
          const logs = [];
          const service = new ExternalIdentityService(
            { credentials: async () => ({ clientId: sensitive, clientSecret: sensitive }) },
            { get: () => 'https://identity.example' },
            {},
            {},
            { consume: async () => transaction },
          );
          service.logger = { warn: (text) => logs.push(text) };
          let caught;
          try {
            await service.callback('google', sensitive, sensitive);
          } catch (error) {
            caught = error;
          }
          assert.ok(caught);
          assert.equal(logs[0],
            '[DEBUG-google-oauth] stage=token_exchange substage=' + scenario.substage +
            ' reason=' + scenario.reason);
          assert.equal(logs[1], '外部登录失败 provider=google outcome=rejected');
          assert.equal(logs.join(' ').includes(sensitive), false);
          assert.match(logs[0], /^\\[DEBUG-google-oauth\\] stage=(discovery|token_exchange|claims_projection) substage=(authorization_response|token_response_shape|id_token_signature|id_token_claim|jwks|unknown) reason=(validation_failed|invalid_shape|verification_failed|key_resolution_failed|unclassified)$/);
        }
        process.stdout.write('google diagnostics are stage-safe\\n');
      })().catch((error) => { console.error(error); process.exit(1); });
    `;
    const result = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', '-e', script],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('google diagnostics are stage-safe');
  });
});
