import { z } from 'zod/v4';

import type { Bead } from '@/types';

export type JsonObject = Record<string, unknown>;

export const BeadFormResponseSchema = z.object({
  submittedBy: z.string().min(1),
  submittedAt: z.string().min(1),
  values: z.record(z.string(), z.unknown()),
  webhookMarkdown: z.string().optional(),
});

export const BeadFormSchema = z.object({
  id: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().min(1),
  description: z.string().optional(),
  version: z.number().int().positive().optional(),
  html: z.string().min(1),
  responses: z.array(BeadFormResponseSchema).optional(),
}).passthrough();

export const BeadsWebMetadataSchema = z.object({
  forms: z.array(BeadFormSchema).optional(),
}).passthrough();

export type BeadForm = z.infer<typeof BeadFormSchema>;
export type BeadFormResponse = z.infer<typeof BeadFormResponseSchema>;

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'blockquote', 'br', 'button', 'caption', 'code', 'col', 'colgroup',
  'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'fieldset', 'form', 'h1',
  'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'input', 'ins', 'kbd', 'label', 'legend', 'li',
  'mark', 'ol', 'optgroup', 'option', 'output', 'p', 'pre', 's', 'samp', 'section',
  'select', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td',
  'textarea', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'var',
]);

const GLOBAL_ATTRS = new Set([
  'aria-describedby', 'aria-label', 'aria-labelledby', 'aria-required', 'class', 'dir',
  'for', 'id', 'lang', 'role', 'style', 'title',
]);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  button: new Set(['disabled', 'name', 'type', 'value']),
  col: new Set(['span']),
  form: new Set(['action', 'method', 'name']),
  input: new Set([
    'accept', 'autocomplete', 'checked', 'disabled', 'max', 'maxlength', 'min',
    'minlength', 'multiple', 'name', 'pattern', 'placeholder', 'readonly', 'required',
    'step', 'type', 'value',
  ]),
  label: new Set(['for']),
  optgroup: new Set(['disabled', 'label']),
  option: new Set(['disabled', 'label', 'selected', 'value']),
  output: new Set(['for', 'name']),
  select: new Set(['autocomplete', 'disabled', 'multiple', 'name', 'required', 'size']),
  textarea: new Set(['autocomplete', 'cols', 'disabled', 'maxlength', 'minlength', 'name', 'placeholder', 'readonly', 'required', 'rows']),
  td: new Set(['colspan', 'headers', 'rowspan']),
  th: new Set(['colspan', 'headers', 'rowspan', 'scope']),
};

const SAFE_INPUT_TYPES = new Set([
  'checkbox', 'date', 'datetime-local', 'email', 'hidden', 'month', 'number', 'password',
  'radio', 'range', 'search', 'tel', 'text', 'time', 'url', 'week',
]);

const SAFE_CSS_PROPERTIES = new Set([
  'align-items', 'background-color', 'border', 'border-color', 'border-radius',
  'border-style', 'border-width', 'color', 'display', 'flex-direction', 'font-size',
  'font-style', 'font-weight', 'gap', 'grid-template-columns', 'justify-content',
  'line-height', 'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top',
  'max-width', 'min-width', 'padding', 'padding-bottom', 'padding-left', 'padding-right',
  'padding-top', 'text-align', 'text-decoration', 'width', 'white-space',
]);

const UNSAFE_CSS_VALUE = /url\s*\(|expression\s*\(|@import|behavior\s*:|javascript:/i;

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('mailto:');
}

function sanitizeStyle(value: string): string {
  return value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const [property, ...rest] = declaration.split(':');
      const name = property?.trim().toLowerCase();
      const cssValue = rest.join(':').trim();
      if (!name || !cssValue) return '';
      if (!SAFE_CSS_PROPERTIES.has(name)) return '';
      if (UNSAFE_CSS_VALUE.test(cssValue)) return '';
      return `${name}: ${cssValue}`;
    })
    .filter(Boolean)
    .join('; ');
}

function sanitizeElement(element: Element): void {
  const tagName = element.tagName.toLowerCase();

  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    const isAllowed = GLOBAL_ATTRS.has(name) || TAG_ATTRS[tagName]?.has(name);

    if (!isAllowed || name.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (name === 'style') {
      const safeStyle = sanitizeStyle(value);
      if (safeStyle) element.setAttribute('style', safeStyle);
      else element.removeAttribute('style');
      continue;
    }

    if (name === 'href' && !isSafeUrl(value)) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (tagName === 'input' && name === 'type' && !SAFE_INPUT_TYPES.has(value.toLowerCase())) {
      element.setAttribute('type', 'text');
      continue;
    }

    if (tagName === 'form' && name === 'method') {
      element.setAttribute('method', 'post');
      continue;
    }

    if (tagName === 'form' && name === 'action') {
      element.setAttribute('action', '/api/beads/forms/submit');
    }
  }

  if (tagName === 'form') {
    element.setAttribute('method', 'post');
    element.setAttribute('action', '/api/beads/forms/submit');
  }
}

function sanitizeNode(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tagName = element.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tagName)) {
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }
      sanitizeElement(element);
      sanitizeNode(element);
    } else if (child.nodeType !== Node.TEXT_NODE) {
      child.remove();
    }
  }
}

export function sanitizeFormHtml(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return '';
  const document = new DOMParser().parseFromString(html, 'text/html');
  sanitizeNode(document.body);
  return document.body.innerHTML;
}

export function getBeadForms(bead: Pick<Bead, 'metadata'>): BeadForm[] {
  const metadata = bead.metadata;
  if (!isObject(metadata) || !isObject(metadata.beadsWeb)) return [];

  const parsed = BeadsWebMetadataSchema.safeParse(metadata.beadsWeb);
  if (!parsed.success) return [];

  return parsed.data.forms ?? [];
}

export function formDataToValues(formData: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Array.from(formData.entries())) {
    if (key.startsWith('__beadsWeb_')) continue;
    const normalized = value instanceof File ? value.name : value;
    if (values[key] === undefined) {
      values[key] = normalized;
    } else if (Array.isArray(values[key])) {
      (values[key] as unknown[]).push(normalized);
    } else {
      values[key] = [values[key], normalized];
    }
  }
  return values;
}

export function mergeFormResponse(
  metadata: unknown,
  formId: string,
  values: Record<string, unknown>,
  submittedAt: string = new Date().toISOString(),
  submittedBy = 'user',
  webhookMarkdown?: string
): JsonObject {
  const next: JsonObject = isObject(metadata) ? structuredClone(metadata) as JsonObject : {};
  if (!isObject(next.beadsWeb)) next.beadsWeb = {};
  const beadsWeb = next.beadsWeb as JsonObject;
  if (!Array.isArray(beadsWeb.forms)) beadsWeb.forms = [];

  const forms = beadsWeb.forms as unknown[];
  const form = forms.find((candidate: unknown) => isObject(candidate) && candidate.id === formId);
  if (!isObject(form)) {
    throw new Error(`Form not found: ${formId}`);
  }

  if (!Array.isArray(form.responses)) form.responses = [];
  const responses = form.responses as unknown[];
  const response: BeadFormResponse = { submittedBy, submittedAt, values };
  if (webhookMarkdown) response.webhookMarkdown = webhookMarkdown;
  responses.push(response);
  return next;
}
