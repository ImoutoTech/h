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
        html: '<p title="{{name}}">Hello {{name}}</p><script>alert(1)</script>',
        allowedVariables: ['name'],
      },
      { name: '"><img src=x onerror=alert(1)>' },
    );
    expect(result.subject).toContain('<img');
    expect(result.html).toContain(
      'title="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"',
    );
    expect(result.html).toContain('&lt;img');
    expect(result.html).not.toContain('<img');
    expect(result.html).not.toContain('<script');
  });

  it('preserves email CSS and presentation attributes in rendered templates', () => {
    const css = [
      '.card { color: #123456; font-family: Inter, sans-serif; }',
      '@media only screen and (max-width: 600px) { .card { width: 100% !important; } }',
    ].join('');
    const inlineCss = [
      '--brand: #123456; ',
      'mso-line-height-rule: exactly; ',
      'color: var(--brand); ',
      'padding: calc(8px + 1vw)',
    ].join('');
    const result = renderer.render(
      {
        subject: 'Review {{label}}',
        text: 'Review {{label}}',
        html: [
          `<style type="text/css">${css}</style>`,
          '<table class="card" id="message-card" role="presentation" ',
          'aria-label="Message" width="100%" cellpadding="0" cellspacing="0" ',
          `border="0" bgcolor="#ffffff" style="${inlineCss}">`,
          '<tr><td align="center" valign="top" background="https://example.com/bg.png">',
          '<a href="https://example.com/review" target="_blank" rel="noopener" ',
          'style="display: inline-block; background: linear-gradient(#123456, #345678);">',
          '{{label}}</a></td></tr></table>',
        ].join(''),
        allowedVariables: ['label'],
      },
      { label: 'Review <now>' },
    );

    expect(result.html).toContain(`<style type="text/css">${css}</style>`);
    expect(result.html).toContain(`style="${inlineCss}"`);
    expect(result.html).toContain(
      'role="presentation" aria-label="Message" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff"',
    );
    expect(result.html).toContain(
      'align="center" valign="top" background="https://example.com/bg.png"',
    );
    expect(result.html).toContain(
      'target="_blank" rel="noopener" style="display: inline-block; background: linear-gradient(#123456, #345678);"',
    );
    expect(result.html).toContain('Review &lt;now&gt;');
    expect(result.html).not.toContain('<now>');
  });

  it('preserves arbitrary CSS and common layout attributes in direct HTML', () => {
    const html = renderer.sanitize(
      [
        '<html lang="en"><head>',
        '<style media="screen">@media (prefers-color-scheme: dark) { .panel:hover { color: rgb(1 2 3 / 50%); } }</style>',
        '</head><body bgcolor="#f7f7f7" style="margin: 0; min-width: 100%">',
        '<table role="presentation" width="640" cellpadding="12" cellspacing="0" border="0">',
        '<tr bgcolor="#ffffff"><td colspan="2" nowrap style="unknown-mail-prop: value; padding: 1px 2px 3px 4px">',
        '<img src="https://example.com/logo.png" srcset="https://example.com/logo@2x.png 2x" ',
        'alt="Logo" width="120" height="40" hspace="4" vspace="2" style="display: block">',
        '</td></tr></table></body></html>',
      ].join(''),
    );

    expect(html).toContain(
      '<style media="screen">@media (prefers-color-scheme: dark) { .panel:hover { color: rgb(1 2 3 / 50%); } }</style>',
    );
    expect(html).toContain(
      '<body bgcolor="#f7f7f7" style="margin: 0; min-width: 100%">',
    );
    expect(html).toContain(
      '<table role="presentation" width="640" cellpadding="12" cellspacing="0" border="0">',
    );
    expect(html).toContain(
      '<td colspan="2" nowrap style="unknown-mail-prop: value; padding: 1px 2px 3px 4px">',
    );
    expect(html).toContain(
      'srcset="https://example.com/logo@2x.png 2x" alt="Logo" width="120" height="40" hspace="4" vspace="2" style="display: block"',
    );
  });

  it('removes active content and unsafe URLs from direct HTML', () => {
    const html = renderer.sanitize(
      [
        '<link rel="stylesheet" href="https://evil.example/styles.css">',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
        '<script>alert(1)</script>',
        '<iframe src="https://evil.example" srcdoc="<script>alert(1)</script>">frame</iframe>',
        '<object data="https://evil.example/plugin">object</object>',
        '<embed src="https://evil.example/plugin">',
        '<applet code="evil">applet</applet>',
        '<form action="https://evil.example"><input value="x"><button>submit</button>',
        '<select><option>choice</option></select><textarea>text</textarea></form>',
        '<div srcdoc="<p>evil</p>" onclick="alert(1)">safe</div>',
        '<a href="java&#x73;cript:alert(1)" onclick="alert(1)">open</a>',
        '<img src="java&#x0a;script:alert(1)" ',
        'srcset="data:text/html;base64,PHNjcmlwdD4= 1x, java&#x73;cript:alert(1) 2x, https://example.com/safe.png 3x" ',
        'onerror="alert(1)">',
        '<table background="java&#x0a;script:alert(1)"><tr>',
        '<td background="https://example.com/safe-bg.png">cell</td>',
        '</tr></table>',
      ].join(''),
    );

    expect(html).not.toMatch(
      /<(?:script|iframe|object|embed|applet|form|input|button|select|option|textarea|link|meta)\b/i,
    );
    expect(html).not.toContain('onclick=');
    expect(html).not.toContain('onerror=');
    expect(html).not.toContain('srcdoc=');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a>open</a>');
    expect(html).toContain('srcset="https://example.com/safe.png 3x"');
    expect(html).toContain('<table><tr>');
    expect(html).toContain(
      '<td background="https://example.com/safe-bg.png">cell</td>',
    );
  });
});
