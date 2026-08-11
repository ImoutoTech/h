export const RESOURCE_SERVERS = {
  'notification-api': {
    audience: 'notification-api',
    ttl: 300,
    scopes: ['notifications:send', 'notifications:read'],
  },
  'h-internal': {
    audience: 'h-internal',
    ttl: 300,
    scopes: ['users:contact:read'],
  },
  'notification-admin': {
    audience: 'notification-admin',
    ttl: 300,
    scopes: [
      'notifications:read',
      'notifications:send',
      'notifications:manage',
    ],
  },
} as const;

export type ResourceName = keyof typeof RESOURCE_SERVERS;

export const RESOURCE_INDICATORS = Object.fromEntries(
  Object.keys(RESOURCE_SERVERS).map((name) => [name, `urn:h:resource:${name}`]),
) as Record<ResourceName, string>;

export function isResourceName(value: string): value is ResourceName {
  return Object.prototype.hasOwnProperty.call(RESOURCE_SERVERS, value);
}

export function resourceNameFromIndicator(
  indicator: string,
): ResourceName | undefined {
  return (Object.entries(RESOURCE_INDICATORS).find(
    ([, value]) => value === indicator,
  )?.[0] || undefined) as ResourceName | undefined;
}

export const RESOURCE_SCOPES = Array.from(
  new Set(Object.values(RESOURCE_SERVERS).flatMap(({ scopes }) => scopes)),
);

export function normalizedScopes(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : (value || '').split(' ');
  return Array.from(
    new Set(values.map((item) => item.trim()).filter(Boolean)),
  ).sort();
}

export function isClientCredentialsRequest(ctx: any): boolean {
  return ctx?.oidc?.params?.grant_type === 'client_credentials';
}
