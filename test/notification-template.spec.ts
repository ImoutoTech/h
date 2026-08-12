import { describe, expect, it } from 'vitest';
import { TemplateRenderer } from '../src/module/notification/template-renderer';

describe('notification template renderer', () => {
  const renderer = new TemplateRenderer();

  it('validates declarations and rejects malformed or unknown tokens', () => {
    expect(() =>
      renderer.validate('Hello {{name}}', 'Code {{code}}', null, [
        'name',
        'code',
      ]),
    ).not.toThrow();
    expect(() =>
      renderer.validate('Hello {{unknown}}', 'Text', null, ['name']),
    ).toThrow();
    expect(() =>
      renderer.validate('Hello {{name', 'Text', null, ['name']),
    ).toThrow();
  });

  it('requires an exact variable contract', () => {
    const source = {
      subject: 'Hello {{name}}',
      text: 'Code {{code}}',
      allowedVariables: ['name', 'code'],
    };
    expect(() => renderer.render(source, { name: 'Ada' })).toThrow();
    expect(() =>
      renderer.render(source, { name: 'Ada', code: '123', extra: 'x' }),
    ).toThrow();
  });

  it('escapes interpolated HTML and removes executable markup', () => {
    const result = renderer.render(
      {
        subject: 'Hello {{name}}',
        text: 'Hello {{name}}',
        html: '<p>Hello {{name}}</p><script>alert(1)</script>',
        allowedVariables: ['name'],
      },
      { name: '<img src=x onerror=alert(1)>' },
    );
    expect(result.subject).toContain('<img');
    expect(result.html).toContain('&lt;img');
    expect(result.html).not.toContain('<img');
    expect(result.html).not.toContain('<script');
  });

  it('sanitizes direct HTML using the same allowlist', () => {
    const html = renderer.sanitize(
      '<a href="javascript:alert(1)" onclick="alert(1)">open</a>',
    );
    expect(html).toBe('<a>open</a>');
  });
});
