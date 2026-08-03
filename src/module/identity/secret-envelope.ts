import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface SecretEnvelope {
  ciphertext: string;
  iv: string;
  tag: string;
  hint: string;
  keyVersion: string;
}

export function parseSecretKey(value: string): Buffer {
  const key = Buffer.from(value || '', 'base64');
  if (key.length !== 32)
    throw new Error('PROVIDER_SECRET_KEY must be a base64 encoded 32-byte key');
  return key;
}

export function encryptSecret(
  secret: string,
  provider: string,
  key: Buffer,
  keyVersion: string,
): SecretEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${provider}:${keyVersion}`));
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    hint: secret.length <= 4 ? '••••' : `••••${secret.slice(-4)}`,
    keyVersion,
  };
}

export function decryptSecret(
  envelope: SecretEnvelope,
  provider: string,
  key: Buffer,
): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAAD(Buffer.from(`${provider}:${envelope.keyVersion}`));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
