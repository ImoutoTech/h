import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubAppSecret } from '@/entity';
import {
  decryptSecret,
  encryptSecret,
  parseSecretKey,
} from '../identity/secret-envelope';

@Injectable()
export class ClientSecretService {
  constructor(private readonly config: ConfigService) {}

  encrypt(secret: string, appId: string) {
    const version = this.config.get<string>('OIDC_CLIENT_SECRET_KEY_VERSION');
    if (!version) throw new Error('OIDC_CLIENT_SECRET_KEY_VERSION is required');
    return encryptSecret(
      secret,
      `oidc-client:${appId}`,
      parseSecretKey(this.config.get<string>('OIDC_CLIENT_SECRET_KEY')),
      version,
    );
  }

  decrypt(secret: SubAppSecret | undefined, appId: string) {
    if (!secret?.secretCiphertext) {
      throw new Error(`Confidential OIDC client ${appId} has no active secret`);
    }
    return decryptSecret(
      {
        ciphertext: secret.secretCiphertext,
        iv: secret.secretIv,
        tag: secret.secretTag,
        hint: secret.secretHint,
        keyVersion: secret.keyVersion,
      },
      `oidc-client:${appId}`,
      parseSecretKey(this.config.get<string>('OIDC_CLIENT_SECRET_KEY')),
    );
  }
}
