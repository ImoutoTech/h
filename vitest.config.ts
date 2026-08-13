import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import ts from 'typescript';

export default defineConfig({
  plugins: [
    {
      name: 'typescript-decorator-metadata',
      enforce: 'pre',
      transform(source, id) {
        if (!id.endsWith('.ts') || id.includes('/node_modules/')) return;
        const output = ts.transpileModule(source, {
          fileName: id,
          compilerOptions: {
            target: ts.ScriptTarget.ES2021,
            module: ts.ModuleKind.ESNext,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            sourceMap: true,
          },
        });
        return {
          code: output.outputText,
          map: output.sourceMapText,
        };
      },
    },
  ],
  test: {
    setupFiles: ['reflect-metadata'],
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
