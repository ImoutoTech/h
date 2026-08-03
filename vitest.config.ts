import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Several integration regressions boot Nest/ts-node child processes. Give
    // parallel cold starts enough headroom on CI and busy development hosts.
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
