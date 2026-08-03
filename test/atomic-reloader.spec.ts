import { describe, expect, it } from 'vitest';
import { AtomicReloader } from '../src/module/oauth/atomic-reloader';

describe('atomic OIDC provider reload', () => {
  it('coalesces concurrent builds for one client generation', async () => {
    const registry = new AtomicReloader<{ generation: number }>();
    let builds = 0;
    const build = async () => ({ generation: ++builds });
    const values = await Promise.all([
      registry.get('a', build),
      registry.get('a', build),
      registry.get('a', build),
    ]);
    expect(values.map((item) => item.generation)).toEqual([1, 1, 1]);
    expect(builds).toBe(1);
  });

  it('builds a newer generation after an in-flight stale generation', async () => {
    const registry = new AtomicReloader<string>();
    let release: () => void;
    const first = registry.get(
      'old',
      () => new Promise<string>((resolve) => (release = () => resolve('old'))),
    );
    const next = registry.get('new', async () => 'new');
    release();
    expect(await first).toBe('old');
    expect(await next).toBe('new');
    expect(await registry.get('new', async () => 'unexpected')).toBe('new');
  });
});
