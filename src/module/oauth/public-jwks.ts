export function toPublicJwk(jwk: Record<string, any>) {
  const publicJwk = { ...jwk };
  for (const property of ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth']) {
    delete publicJwk[property];
  }
  return publicJwk;
}

export function publicJwks(
  currentPrivate: Record<string, any>,
  previousPublic?: Record<string, any>,
) {
  if (previousPublic?.d) throw new Error('Previous JWK must be public');
  return {
    keys: [toPublicJwk(currentPrivate), previousPublic].filter(Boolean),
  };
}
