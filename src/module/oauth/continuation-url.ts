const RESPONSE_PARAMETERS = new Set([
  'code',
  'state',
  'iss',
  'error',
  'error_description',
  'error_uri',
]);

export function isRegisteredContinuation(
  value: string,
  registeredUris: string[],
) {
  try {
    const target = new URL(value);
    return registeredUris.some((registered) => {
      const expected = new URL(registered);
      if (
        target.origin !== expected.origin ||
        target.pathname !== expected.pathname ||
        target.hash !== expected.hash
      )
        return false;
      for (const [key, expectedValue] of expected.searchParams) {
        if (target.searchParams.get(key) !== expectedValue) return false;
      }
      return [...target.searchParams.keys()].every(
        (key) => expected.searchParams.has(key) || RESPONSE_PARAMETERS.has(key),
      );
    });
  } catch {
    return false;
  }
}

export function isProviderResumeContinuation(value: string, issuer: string) {
  try {
    const target = new URL(value);
    const expected = new URL(issuer);
    const resumePrefix = `${expected.pathname.replace(/\/$/, '')}/auth/`;
    return (
      target.origin === expected.origin &&
      target.pathname.startsWith(resumePrefix) &&
      target.pathname.length > resumePrefix.length &&
      !target.username &&
      !target.password &&
      !target.hash
    );
  } catch {
    return false;
  }
}
