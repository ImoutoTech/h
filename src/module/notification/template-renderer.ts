import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { notificationError } from './notification-error';

const TOKEN = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g;
const OPEN_TOKEN = /{{|}}/;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class TemplateRenderer {
  references(value?: string | null) {
    const input = value || '';
    const stripped = input.replace(TOKEN, '');
    if (OPEN_TOKEN.test(stripped))
      notificationError('notification_invalid_variables');
    const names = new Set<string>();
    for (const match of input.matchAll(TOKEN)) names.add(match[1]);
    return names;
  }

  validate(
    subject: string,
    text: string,
    html: string | null | undefined,
    allowedVariables: string[],
  ) {
    if (!subject.trim() || !text.trim())
      notificationError('notification_invalid_variables');
    const allowed = new Set(allowedVariables);
    const referenced = new Set([
      ...this.references(subject),
      ...this.references(text),
      ...this.references(html),
    ]);
    if ([...referenced].some((name) => !allowed.has(name)))
      notificationError('notification_invalid_variables');
  }

  render(
    source: {
      subject: string;
      text: string;
      html?: string | null;
      allowedVariables: string[];
    },
    variables: Record<string, string>,
  ) {
    const expected = new Set(source.allowedVariables);
    const supplied = Object.keys(variables || {});
    if (
      supplied.length !== expected.size ||
      supplied.some((name) => !expected.has(name)) ||
      supplied.some(
        (name) =>
          typeof variables[name] !== 'string' || variables[name].length > 10240,
      )
    ) {
      notificationError('notification_invalid_variables');
    }
    const interpolate = (value: string, html = false) =>
      value.replace(TOKEN, (_, name: string) =>
        html ? escapeHtml(variables[name]) : variables[name],
      );
    return {
      subject: interpolate(source.subject),
      text: interpolate(source.text),
      html: source.html
        ? this.sanitize(interpolate(source.html, true))
        : undefined,
    };
  }

  sanitize(html: string) {
    return sanitizeHtml(html, {
      allowedTags: [
        'a',
        'b',
        'blockquote',
        'br',
        'code',
        'div',
        'em',
        'h1',
        'h2',
        'h3',
        'hr',
        'i',
        'img',
        'li',
        'ol',
        'p',
        'pre',
        'span',
        'strong',
        'table',
        'tbody',
        'td',
        'th',
        'thead',
        'tr',
        'u',
        'ul',
      ],
      allowedAttributes: {
        a: ['href', 'title'],
        img: ['src', 'alt', 'title', 'width', 'height'],
        '*': ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      disallowedTagsMode: 'discard',
    });
  }
}
