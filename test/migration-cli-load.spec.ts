import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('TypeORM migration CLI runtime', () => {
  it('preloads path aliases and builds all entity metadata without a database', () => {
    const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const result = spawnSync(pnpm, ['run', 'migration:check-load'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('typeorm metadata loaded');
  });
});
