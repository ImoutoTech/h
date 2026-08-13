import { describe, expect, it } from 'vitest';
import {
  isClientCredentialsRequest,
  normalizedScopes,
  resourceNameFromIndicator,
  RESOURCE_INDICATORS,
  RESOURCE_SERVERS,
} from '../src/module/oauth/resource-servers';

describe('OAuth resource catalog', () => {
  it('keeps machine resources on a five minute JWT contract', () => {
    expect(RESOURCE_SERVERS['notification-api']).toMatchObject({
      audience: 'notification-api',
      ttl: 300,
      scopes: ['notifications:send', 'notifications:read'],
    });
    expect(RESOURCE_SERVERS['h-internal']).toMatchObject({
      audience: 'h-internal',
      ttl: 300,
      scopes: ['users:contact:read'],
    });
  });

  it('uses RFC 8707 URI resource indicators without changing token audiences', () => {
    expect(RESOURCE_INDICATORS['h-internal']).toBe('urn:h:resource:h-internal');
    expect(resourceNameFromIndicator('urn:h:resource:notification-api')).toBe(
      'notification-api',
    );
    expect(resourceNameFromIndicator('notification-api')).toBeUndefined();
  });

  it('normalizes requested scopes before permission intersection', () => {
    expect(
      normalizedScopes(
        'notifications:send  notifications:read notifications:send',
      ),
    ).toEqual(['notifications:read', 'notifications:send']);
  });

  it('identifies client credentials requests so user-only resources stay isolated', () => {
    expect(
      isClientCredentialsRequest({
        oidc: { params: { grant_type: 'client_credentials' } },
      }),
    ).toBe(true);
    expect(
      isClientCredentialsRequest({
        oidc: { params: { grant_type: 'authorization_code' } },
      }),
    ).toBe(false);
  });
});
