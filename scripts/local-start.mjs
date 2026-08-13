#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import dotenv from 'dotenv';

const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(['--check', '--skip-migrations', '--help']);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));

if (args.has('--help')) {
  process.stdout.write(
    `Usage: pnpm local:start [-- --check|--skip-migrations]\n\n`,
  );
  process.stdout.write(
    `  --check            validate config and migration metadata, then exit\n`,
  );
  process.stdout.write(
    `  --skip-migrations  validate config and start without applying migrations\n`,
  );
  process.exit(0);
}

if (unknownArgs.length > 0) fail(`unknown option: ${unknownArgs[0]}`);

const templateEnvFile = '.env';
const localEnvFile = '.env.development.local';
if (!existsSync(templateEnvFile)) {
  fail(`missing tracked ${templateEnvFile} configuration template`);
}

const templateEnv = dotenv.parse(readFileSync(templateEnvFile));
const localEnv = existsSync(localEnvFile)
  ? dotenv.parse(readFileSync(localEnvFile))
  : {};

// Match the application's dotenv precedence: local configuration overrides the
// tracked template, while explicitly injected process variables override both.
process.env = { ...templateEnv, ...localEnv, ...process.env };

const required = [
  'MYSQL_SERVER',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_DATABASE',
  'PWD_SALT_ROUND',
  'TOKEN_SECRET',
  'OIDC_ISSUER',
  'OIDC_SIGNING_JWK',
  'OIDC_SIGNING_KID',
  'OIDC_CLIENT_SECRET_KEY',
  'OIDC_CLIENT_SECRET_KEY_VERSION',
  'PROVIDER_SECRET_KEY',
  'PROVIDER_SECRET_KEY_VERSION',
  'PUBLIC_URL',
  'SAFE_HOUSE_PUBLIC_URL',
  'EMAIL_VERIFICATION_PEPPER',
  'NOTIFICATION_API_URL',
  'NOTIFICATION_CLIENT_ID',
  'NOTIFICATION_CLIENT_SECRET',
  'NOTIFICATION_CONTACT_CLIENT_IDS',
];

for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value || /replace|example\.test/iu.test(value)) {
    fail(`${name} is missing or still contains a placeholder`);
  }
}

if (process.env.NODE_ENV === 'production') {
  fail('local:start refuses NODE_ENV=production');
}
if (process.env.TYPEORM_SYNCHRONIZE === 'true') {
  fail('TYPEORM_SYNCHRONIZE must be false; use migrations');
}

for (const name of [
  'EMAIL_VERIFICATION_TTL_SECONDS',
  'EMAIL_VERIFICATION_COOLDOWN_SECONDS',
  'EMAIL_VERIFICATION_MAX_ATTEMPTS',
]) {
  const value = process.env[name];
  if (
    value !== undefined &&
    (!Number.isSafeInteger(Number(value)) || Number(value) <= 0)
  ) {
    fail(`${name} must be a positive integer when set`);
  }
}
if (Number(process.versions.node.split('.')[0]) !== 22) {
  fail('Node.js 22 LTS is required');
}

for (const name of [
  'OIDC_ISSUER',
  'PUBLIC_URL',
  'SAFE_HOUSE_PUBLIC_URL',
  'NOTIFICATION_API_URL',
]) {
  let url;
  try {
    url = new URL(process.env[name]);
  } catch {
    fail(`${name} must be an absolute URL`);
  }
  if (!['https:', 'http:'].includes(url.protocol))
    fail(`${name} must use HTTP(S)`);
}

let signingJwk;
try {
  signingJwk = JSON.parse(process.env.OIDC_SIGNING_JWK);
} catch {
  fail('OIDC_SIGNING_JWK must be valid JSON');
}
if (signingJwk.kty !== 'RSA' || !signingJwk.d) {
  fail('OIDC_SIGNING_JWK must be an RSA private JWK');
}
if (signingJwk.kid && signingJwk.kid !== process.env.OIDC_SIGNING_KID) {
  fail('OIDC_SIGNING_JWK kid must match OIDC_SIGNING_KID');
}

const previousJwkText = process.env.OIDC_PREVIOUS_PUBLIC_JWK?.trim();
const previousKid = process.env.OIDC_PREVIOUS_KID?.trim();
if (Boolean(previousJwkText) !== Boolean(previousKid)) {
  fail('OIDC_PREVIOUS_PUBLIC_JWK and OIDC_PREVIOUS_KID must be set together');
}
if (previousJwkText) {
  let previousJwk;
  try {
    previousJwk = JSON.parse(previousJwkText);
  } catch {
    fail('OIDC_PREVIOUS_PUBLIC_JWK must be valid JSON');
  }
  if (previousJwk.kty !== 'RSA' || previousJwk.d || !previousJwk.kid) {
    fail('OIDC_PREVIOUS_PUBLIC_JWK must be an RSA public JWK with a kid');
  }
  if (previousJwk.kid !== previousKid) {
    fail('OIDC_PREVIOUS_PUBLIC_JWK kid must match OIDC_PREVIOUS_KID');
  }
}

for (const name of ['OIDC_CLIENT_SECRET_KEY', 'PROVIDER_SECRET_KEY']) {
  const decoded = Buffer.from(process.env[name], 'base64');
  if (
    decoded.length !== 32 ||
    decoded.toString('base64') !== process.env[name]
  ) {
    fail(`${name} must be the canonical base64 encoding of exactly 32 bytes`);
  }
}

process.stdout.write(
  'Local configuration validated (secret values were not printed).\n',
);
run('pnpm', ['run', 'migration:check-load']);

if (args.has('--check')) process.exit(0);

if (!args.has('--skip-migrations')) {
  run('pnpm', ['run', 'migration:show']);
  run('pnpm', ['run', 'migration:run']);
}

process.stdout.write('Starting H; readiness endpoint: GET /health\n');
run('pnpm', ['run', 'start:dev']);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) fail(`${command} could not be executed`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message) {
  process.stderr.write(`local:start: ${message}\n`);
  process.exit(1);
}
