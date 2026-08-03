import { describe, expect, it } from 'vitest';
import { resolveListenPort } from '../src/utils/listen-port';

describe('listen port configuration', () => {
  it('preserves the compatibility default when PORT is absent', () => {
    expect(resolveListenPort(undefined)).toBe(4000);
    expect(resolveListenPort('')).toBe(4000);
  });

  it('accepts valid integer ports', () => {
    expect(resolveListenPort('3000')).toBe(3000);
    expect(resolveListenPort(65535)).toBe(65535);
  });

  it.each(['0', '65536', '-1', '3000.5', 'abc', ' 3000 '])(
    'rejects unsafe PORT=%s',
    (value) => {
      expect(() => resolveListenPort(value)).toThrow(
        'PORT must be an integer between 1 and 65535',
      );
    },
  );
});
