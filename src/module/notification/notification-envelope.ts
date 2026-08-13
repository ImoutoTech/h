import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NotificationEnvelope {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: string;
}

function parseKey(value: string, label: string): Buffer {
  const key = Buffer.from(value || '', 'base64');
  if (key.length !== 32)
    throw new Error(`${label} must be a base64 encoded 32-byte key`);
  return key;
}

@Injectable()
export class NotificationEnvelopeService {
  constructor(private readonly config: ConfigService) {}

  currentVersion() {
    return this.config.get<string>('NOTIFICATION_SECRET_KEY_VERSION');
  }

  private key(version: string) {
    const currentVersion = this.currentVersion();
    if (version === currentVersion) {
      return parseKey(
        this.config.get<string>('NOTIFICATION_SECRET_KEY'),
        'NOTIFICATION_SECRET_KEY',
      );
    }
    let versions: Record<string, string> = {};
    try {
      versions = JSON.parse(
        this.config.get<string>('NOTIFICATION_SECRET_KEYS', '{}'),
      );
    } catch {
      throw new Error('NOTIFICATION_SECRET_KEYS must be a JSON object');
    }
    if (!versions[version])
      throw new Error(
        `Notification encryption key version ${version} is unavailable`,
      );
    return parseKey(versions[version], `NOTIFICATION_SECRET_KEYS[${version}]`);
  }

  encrypt(plaintext: string, purpose: string): NotificationEnvelope {
    const keyVersion = this.currentVersion();
    if (!keyVersion)
      throw new Error('NOTIFICATION_SECRET_KEY_VERSION is required');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(keyVersion), iv);
    cipher.setAAD(Buffer.from(`${purpose}:${keyVersion}`));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      keyVersion,
    };
  }

  decrypt(envelope: NotificationEnvelope, purpose: string): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(envelope.keyVersion),
      Buffer.from(envelope.iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(`${purpose}:${envelope.keyVersion}`));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  assertVersionAvailable(version: string) {
    this.key(version);
  }

  hint(secret: string) {
    return secret.length <= 4 ? '••••' : `••••${secret.slice(-4)}`;
  }
}
