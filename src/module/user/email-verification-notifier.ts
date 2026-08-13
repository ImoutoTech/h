import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MachineToken {
  accessToken: string;
  expiresAt: number;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface NotificationResponse {
  notificationId?: string;
}

@Injectable()
export class EmailVerificationNotifier {
  private token?: MachineToken;

  constructor(private readonly config: ConfigService) {}

  async send(input: {
    challengeId: string;
    email: string;
    code: string;
    expiresAt: Date;
  }): Promise<string> {
    const apiUrl = this.config.get<string>('NOTIFICATION_API_URL');
    if (!apiUrl) throw new Error('NOTIFICATION_API_URL is required');
    const accessToken = await this.accessToken();
    const response = await fetch(new URL('/v1/notifications', apiUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.challengeId,
      },
      body: JSON.stringify({
        template: 'account.email.verify',
        recipient: {
          kind: 'address',
          channel: 'email',
          address: input.email,
        },
        variables: { code: input.code },
        expiresAt: input.expiresAt.toISOString(),
      }),
    });
    if (response.status !== 202)
      throw new Error('Email verification notification was rejected');
    const result = (await response.json()) as NotificationResponse;
    if (!result.notificationId)
      throw new Error('Email verification notification id is missing');
    return result.notificationId;
  }

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt > now + 10_000)
      return this.token.accessToken;

    const issuer = this.config.get<string>('OIDC_ISSUER');
    const clientId = this.config.get<string>('NOTIFICATION_CLIENT_ID');
    const clientSecret = this.config.get<string>('NOTIFICATION_CLIENT_SECRET');
    if (!issuer || !clientId || !clientSecret)
      throw new Error(
        'Email verification notification client is not configured',
      );
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      resource: 'urn:h:resource:notification-api',
      scope: 'notifications:send',
    });
    const response = await fetch(
      new URL('token', `${issuer.replace(/\/$/u, '')}/`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    if (!response.ok)
      throw new Error('Email verification notification token was rejected');
    const result = (await response.json()) as TokenResponse;
    if (!result.access_token)
      throw new Error('Email verification notification token is missing');
    const expiresIn = Math.max(1, Number(result.expires_in) || 300);
    this.token = {
      accessToken: result.access_token,
      expiresAt: now + expiresIn * 1000,
    };
    return result.access_token;
  }
}
