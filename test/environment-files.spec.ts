import { describe, expect, it } from 'vitest';
import { environmentFiles } from '../src/utils/constants';

describe('environment file selection', () => {
  it('never loads the developer-local file in production', () => {
    expect(environmentFiles('production')).toEqual([
      '.env.production.local',
      '.env.production',
      '.env',
    ]);
    expect(environmentFiles('production')).not.toContain(
      '.env.development.local',
    );
  });

  it('loads developer-local overrides before the tracked template locally', () => {
    expect(environmentFiles('development')).toEqual([
      '.env.development.local',
      '.env.development',
      '.env',
    ]);
  });
});
