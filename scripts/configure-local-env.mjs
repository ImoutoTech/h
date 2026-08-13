#!/usr/bin/env node

import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import dotenv from 'dotenv';

const localEnvFile = '.env.development.local';
const source = existsSync(localEnvFile)
  ? readFileSync(localEnvFile, 'utf8')
  : '';
const parsed = dotenv.parse(source);
const generated = [];
const preserved = [];

ensureSecret('TOKEN_SECRET', () => randomBytes(32).toString('base64url'));
ensureSecret('EMAIL_VERIFICATION_PEPPER', () =>
  randomBytes(32).toString('base64'),
);
ensureSigningKey();
ensureSecret('OIDC_CLIENT_SECRET_KEY', () =>
  randomBytes(32).toString('base64'),
);
ensureVersion('OIDC_CLIENT_SECRET_KEY_VERSION');
ensureSecret('PROVIDER_SECRET_KEY', () => randomBytes(32).toString('base64'));
ensureVersion('PROVIDER_SECRET_KEY_VERSION');
normalizePreviousSigningPair();
ensureLocalValue('PORT', '3000');
ensureLocalValue('OIDC_ISSUER', 'http://localhost:3000/oidc');
ensureLocalValue('PUBLIC_URL', 'http://localhost:3000');
ensureLocalValue('NOTIFICATION_API_URL', 'http://localhost:4100');
ensurePlaceholder('NOTIFICATION_CLIENT_ID', 'replace-with-generated-h-sender-client-id');
ensurePlaceholder('NOTIFICATION_CLIENT_SECRET', 'replace-with-one-time-provisioned-client-secret');
ensurePlaceholder('NOTIFICATION_CONTACT_CLIENT_IDS', 'replace-with-generated-notification-service-client-id');

let output = source;
for (const [name, value] of Object.entries(parsed)) {
  if (!generated.includes(name)) continue;
  const line = `${name}=${quote(value)}`;
  const pattern = new RegExp(`^${name}=.*$`, 'mu');
  if (pattern.test(output)) output = output.replace(pattern, line);
  else output += `${output && !output.endsWith('\n') ? '\n' : ''}${line}\n`;
}

writeFileSync(localEnvFile, output, { mode: 0o600 });
chmodSync(localEnvFile, 0o600);
process.stdout.write(
  `Local environment configured. Generated: ${generated.join(', ') || 'none'}. ` +
    `Preserved: ${preserved.join(', ') || 'none'}. Secret values were not printed.\n`,
);

function ensureSecret(name, create) {
  if (isConfigured(parsed[name])) {
    preserved.push(name);
    return;
  }
  parsed[name] = create();
  generated.push(name);
}

function ensureVersion(name) {
  if (isConfigured(parsed[name])) {
    preserved.push(name);
    return;
  }
  parsed[name] = '1';
  generated.push(name);
}

function ensureLocalValue(name, value) {
  if (isConfigured(parsed[name])) {
    preserved.push(name);
    return;
  }
  parsed[name] = value;
  generated.push(name);
}

function ensurePlaceholder(name, value) {
  if (isConfigured(parsed[name])) {
    preserved.push(name);
    return;
  }
  if (parsed[name] === value) return;
  parsed[name] = value;
  generated.push(name);
}

function ensureSigningKey() {
  const jwkConfigured = isConfigured(parsed.OIDC_SIGNING_JWK);
  const kidConfigured = isConfigured(parsed.OIDC_SIGNING_KID);
  if (jwkConfigured && kidConfigured) {
    preserved.push('OIDC_SIGNING_JWK', 'OIDC_SIGNING_KID');
    return;
  }
  if (jwkConfigured || kidConfigured) {
    fail('current OIDC signing JWK and kid must be configured together');
  }

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = randomUUID();
  const jwk = privateKey.export({ format: 'jwk' });
  parsed.OIDC_SIGNING_JWK = JSON.stringify({
    ...jwk,
    alg: 'RS256',
    use: 'sig',
    kid,
  });
  parsed.OIDC_SIGNING_KID = kid;
  generated.push('OIDC_SIGNING_JWK', 'OIDC_SIGNING_KID');
}

function normalizePreviousSigningPair() {
  const names = ['OIDC_PREVIOUS_PUBLIC_JWK', 'OIDC_PREVIOUS_KID'];
  if (names.every((name) => isConfigured(parsed[name]))) {
    preserved.push(...names);
    return;
  }
  if (names.some((name) => isConfigured(parsed[name]))) {
    fail('previous OIDC public JWK and kid must be configured together');
  }
  // Previous keys represent real rotation history. Never invent one locally;
  // remove placeholders so both optional values remain consistently unset.
  for (const name of names) {
    if (parsed[name] !== undefined && !isConfigured(parsed[name])) {
      parsed[name] = '';
      generated.push(name);
    }
  }
}

function isConfigured(value) {
  return Boolean(
    value?.trim() &&
      !/replace|change-me|placeholder|example\.test|todo|xxx|<|>/iu.test(value),
  );
}

function quote(value) {
  return JSON.stringify(value);
}

function fail(message) {
  process.stderr.write(
    `local:configure: ${message}; existing values were not changed\n`,
  );
  process.exit(1);
}
