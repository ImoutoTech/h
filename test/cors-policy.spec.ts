import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { createCorsOptions } from '../src/utils/cors-options';

function evaluateOrigin(
  policy: ReturnType<typeof createCorsOptions>,
  origin?: string,
) {
  const callback = vi.fn();
  if (typeof policy.origin !== 'function')
    throw new Error('CORS origin callback missing');
  policy.origin(origin, callback);
  return callback;
}

describe('single safe-house CORS policy', () => {
  const policy = createCorsOptions('http://127.0.0.1:5173');

  it('authorizes credentialed safe-house GET/POST and OPTIONS', () => {
    expect(policy.credentials).toBe(true);
    expect(policy.methods).toEqual(
      expect.arrayContaining(['GET', 'POST', 'OPTIONS']),
    );
    expect(policy.allowedHeaders).toEqual(
      expect.arrayContaining(['Authorization', 'Content-Type']),
    );
    expect(policy.optionsSuccessStatus).toBe(204);
    expect(
      evaluateOrigin(policy, 'http://127.0.0.1:5173'),
    ).toHaveBeenCalledWith(null, true);
  });

  it('does not authorize a different origin while allowing non-CORS clients', () => {
    expect(
      evaluateOrigin(policy, 'http://localhost:5173'),
    ).toHaveBeenCalledWith(null, false);
    expect(evaluateOrigin(policy, undefined)).toHaveBeenCalledWith(null, true);
  });

  it('has no legacy middleware or OAuth/OIDC path exception', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app.module.ts'),
      'utf8',
    );
    expect(source).not.toContain('FastifyCorsMiddleware');
    expect(source).not.toContain("exclude('/oauth");
    expect(source).not.toContain("exclude('/oidc");
  });
});
