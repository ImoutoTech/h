import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('notification template renderer production runtime', () => {
  it('renders sanitized HTML from the CommonJS build', () => {
    const build = spawnSync(
      process.execPath,
      ['./node_modules/@nestjs/cli/bin/nest.js', 'build'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );
    expect(build.status, build.stderr || build.stdout).toBe(0);

    const script = [
      "const { TemplateRenderer } = require('./dist/src/module/notification/template-renderer')",
      'const renderer = new TemplateRenderer()',
      "const result = renderer.render({ subject: 'Hello {{name}}', text: 'Hello {{name}}', html: '<p>Hello {{name}}</p><script>alert(1)</script>', allowedVariables: ['name'] }, { name: '<img src=x onerror=alert(1)>' })",
      'process.stdout.write(JSON.stringify(result))',
    ].join(';');
    const runtime = spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(runtime.status, runtime.stderr).toBe(0);
    expect(JSON.parse(runtime.stdout)).toEqual({
      subject: 'Hello <img src=x onerror=alert(1)>',
      text: 'Hello <img src=x onerror=alert(1)>',
      html: '<p>Hello &lt;img src=x onerror=alert(1)&gt;</p>',
    });
  });
});
