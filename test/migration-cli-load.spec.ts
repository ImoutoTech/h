import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
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

  it('uses the parameter-suppressing runner for destructive migration commands', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const runner = readFileSync('src/database/run-migrations.ts', 'utf8');

    expect(packageJson.scripts['migration:run']).toContain(
      'run-migrations.ts run',
    );
    expect(packageJson.scripts['migration:revert']).toContain(
      'run-migrations.ts revert',
    );
    expect(packageJson.scripts['migration:run']).not.toContain(
      'typeorm/cli.js',
    );
    expect(runner).not.toMatch(/console\.(?:log|error)\([^)]*error/);
    expect(runner).not.toMatch(/JSON\.stringify\([^)]*error/);
  });
});
