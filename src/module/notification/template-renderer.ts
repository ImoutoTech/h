import { Injectable } from '@nestjs/common';
import * as sanitizeHtmlModule from 'sanitize-html';
import { notificationError } from './notification-error';

const sanitizeHtml =
  typeof sanitizeHtmlModule === 'function'
    ? sanitizeHtmlModule
    : (sanitizeHtmlModule as { default: typeof sanitizeHtmlModule }).default;

const TOKEN = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g;
const OPEN_TOKEN = /{{|}}/;

const EMAIL_DISPLAY_TAGS = [
  'a',
  'b',
  'blockquote',
  'body',
  'br',
  'caption',
  'center',
  'code',
  'col',
  'colgroup',
  'div',
  'em',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'hr',
  'html',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'small',
  'span',
  'strong',
  'style',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'u',
  'ul',
];

const EMAIL_PRESENTATION_ATTRIBUTES = [
  'align',
  'aria-*',
  'background',
  'bgcolor',
  'border',
  'bordercolor',
  'class',
  'dir',
  'height',
  'id',
  'lang',
  'role',
  'style',
  'title',
  'valign',
  'width',
];

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
      allowedTags: EMAIL_DISPLAY_TAGS,
      allowedAttributes: {
        '*': EMAIL_PRESENTATION_ATTRIBUTES,
        a: ['href', 'hreflang', 'name', 'rel', 'target'],
        body: ['alink', 'link', 'marginheight', 'marginwidth', 'text', 'vlink'],
        col: ['char', 'charoff', 'span'],
        colgroup: ['char', 'charoff', 'span'],
        font: ['color', 'face', 'size'],
        img: [
          'alt',
          'decoding',
          'hspace',
          'loading',
          'sizes',
          'src',
          'srcset',
          'vspace',
        ],
        li: ['value'],
        ol: ['reversed', 'start', 'type'],
        style: ['media', 'type'],
        table: ['cellpadding', 'cellspacing', 'frame', 'rules', 'summary'],
        td: [
          'abbr',
          'char',
          'charoff',
          'colspan',
          'headers',
          'nowrap',
          'rowspan',
          'scope',
        ],
        th: [
          'abbr',
          'char',
          'charoff',
          'colspan',
          'headers',
          'nowrap',
          'rowspan',
          'scope',
        ],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesAppliedToAttributes: ['background', 'cite', 'href', 'src'],
      // CSS is authored by trusted template admins or direct-content apps and
      // intentionally remains outside the executable-HTML security boundary.
      allowVulnerableTags: true,
      disallowedTagsMode: 'discard',
      parseStyleAttributes: false,
    });
  }
}
