import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('ExternalIdentityService Nest DI metadata', () => {
  it('retains DataSource and UserService constructor tokens at runtime', () => {
    const script = [
      "require('reflect-metadata')",
      "const { ExternalIdentityService } = require('./src/module/identity/external-identity.service')",
      "const names = Reflect.getMetadata('design:paramtypes', ExternalIdentityService).map((token) => token?.name)",
      'process.stdout.write(JSON.stringify(names))',
    ].join(';');
    const result = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', '-e', script],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const parameterTypes = JSON.parse(result.stdout);
    expect(parameterTypes).toEqual([
      'ProviderConfigService',
      'ConfigService',
      'DataSource',
      'UserService',
      'OneTimeStateService',
    ]);
  });
});
