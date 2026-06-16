import DOMPurify from 'dompurify';
import { z } from 'zod/v4';

import type { Bead } from '@/types';

export type JsonObject = Record<string, unknown>;

export const BeadFormResponseSchema = z.object({
  submittedBy: z.string().min(1),
  submittedAt: z.string().min(1),
  values: z.record(z.string(), z.unknown()),
  webhookMarkdown: z.string().optional(),
});

export const BeadFormControlSchema = z.object({
  id: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(1).optional(),
  type: z.enum([
    'checkbox',
    'date',
    'datetime-local',
    'email',
    'hidden',
    'month',
    'number',
    'password',
    'radio',
    'range',
    'search',
    'select',
    'tel',
    'text',
    'textarea',
    'time',
    'url',
    'week',
  ]),
  required: z.boolean().optional(),
  live: z.boolean().optional(),
  multiple: z.boolean().optional(),
}).passthrough();

export const BeadFormSchema = z.object({
  id: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().min(1),
  description: z.string().optional(),
  version: z.number().int().positive().optional(),
  html: z.string().min(1),
  controls: z.array(BeadFormControlSchema).optional(),
  responses: z.array(BeadFormResponseSchema).optional(),
}).passthrough();

export const BeadsWebMetadataSchema = z.object({
  forms: z.array(BeadFormSchema).optional(),
}).passthrough();

export type BeadForm = z.infer<typeof BeadFormSchema>;
export type BeadFormControl = z.infer<typeof BeadFormControlSchema>;
export type BeadFormResponse = z.infer<typeof BeadFormResponseSchema>;
export type FormLiveValues = Record<string, unknown>;

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

const ALLOWED_ATTRS = Array.from(new Set([
  ...Array.from(GLOBAL_ATTRS),
  ...Object.values(TAG_ATTRS).flatMap((attrs) => Array.from(attrs)),
]));

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

function hardenSanitizedElement(element: Element): void {
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

const CONTROL_SELECTOR = 'input, select, textarea';

function controlIdentifier(element: Element): string | null {
  const id = element.getAttribute('id')?.trim();
  if (id) return id;
  const name = element.getAttribute('name')?.trim();
  if (name) return name;
  return null;
}

function validateControlIdentifiers(root: ParentNode): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();

  for (const element of Array.from(root.querySelectorAll(CONTROL_SELECTOR))) {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase();
    if (tagName === 'input' && type === 'submit') continue;

    const identifier = controlIdentifier(element);
    if (!identifier) {
      errors.push(`${tagName} controls must have a unique id or name`);
      continue;
    }

    const previous = seen.get(identifier);
    if (previous) {
      errors.push(`Duplicate form control identifier "${identifier}" on ${previous} and ${tagName}`);
      continue;
    }
    seen.set(identifier, tagName);
  }

  return errors;
}

function hardenSanitizedTree(root: ParentNode): void {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    hardenSanitizedElement(element);
  }
}

export function sanitizeFormHtml(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return '';
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: Array.from(ALLOWED_TAGS),
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'img', 'audio', 'video', 'source'],
  });
  const document = new DOMParser().parseFromString(sanitized, 'text/html');
  hardenSanitizedTree(document.body);
  return document.body.innerHTML;
}

export function getFormIdentifierErrors(html: string): string[] {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return [];
  const document = new DOMParser().parseFromString(sanitizeFormHtml(html), 'text/html');
  return validateControlIdentifiers(document.body);
}

function htmlControlType(element: Element): BeadFormControl['type'] | null {
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'textarea') return 'textarea';
  if (tagName === 'select') return 'select';
  if (tagName !== 'input') return null;
  const type = element.getAttribute('type')?.toLowerCase() || 'text';
  if (SAFE_INPUT_TYPES.has(type)) return type as BeadFormControl['type'];
  return 'text';
}

export function getFormControlManifestErrors(form: BeadForm): string[] {
  const errors: string[] = [];
  const controls = form.controls ?? [];
  if (controls.length === 0) {
    errors.push('Form metadata must declare controls[] for server-side validation');
    return errors;
  }

  const seenIds = new Set<string>();
  const controlsById = new Map<string, BeadFormControl>();
  for (const control of controls) {
    if (seenIds.has(control.id)) errors.push(`Duplicate control id "${control.id}" in controls[]`);
    seenIds.add(control.id);
    controlsById.set(control.id, control);
    if (!control.name) errors.push(`Control "${control.id}" must declare a name`);
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return errors;
  const document = new DOMParser().parseFromString(sanitizeFormHtml(form.html), 'text/html');
  const htmlIds = new Set<string>();

  for (const element of Array.from(document.body.querySelectorAll(CONTROL_SELECTOR))) {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase();
    if (tagName === 'input' && type === 'submit') continue;

    const id = element.getAttribute('id')?.trim();
    if (!id) {
      errors.push(`${tagName} controls must have an id matching controls[]`);
      continue;
    }
    if (htmlIds.has(id)) errors.push(`Duplicate HTML control id "${id}"`);
    htmlIds.add(id);

    const actualType = htmlControlType(element);
    const htmlName = element.getAttribute('name')?.trim();

    if (actualType === 'radio') {
      const radioControl = controls.find((control) => control.type === 'radio' && control.name === htmlName);
      if (!radioControl) {
        errors.push(`Radio control "${id}" is missing a controls[] radio group for name "${htmlName ?? ''}"`);
      }
      continue;
    }

    const manifest = controlsById.get(id);
    if (!manifest) {
      errors.push(`HTML control "${id}" is missing from controls[]`);
      continue;
    }

    if (manifest.name && htmlName !== manifest.name) {
      errors.push(`Control "${id}" name mismatch: HTML is "${htmlName ?? ''}" but controls[] says "${manifest.name}"`);
    }

    if (actualType && manifest.type !== actualType) {
      errors.push(`Control "${id}" type mismatch: HTML is "${actualType}" but controls[] says "${manifest.type}"`);
    }
  }

  for (const control of controls) {
    if (control.type === 'radio') {
      const selector = `input[type=\"radio\"][name=\"${CSS.escape(control.name ?? '')}\"]`;
      if (!control.name || document.body.querySelectorAll(selector).length === 0) {
        errors.push(`controls[] radio group "${control.id}" does not have matching HTML radio controls`);
      }
      continue;
    }

    if (!htmlIds.has(control.id)) errors.push(`controls[] entry "${control.id}" does not have a matching HTML control`);
  }

  return errors;
}

export function getFormLiveValues(form: BeadForm): FormLiveValues {
  return isObject((form as JsonObject).liveValues)
    ? { ...((form as JsonObject).liveValues as JsonObject) }
    : {};
}

export function applyFormLiveValues(html: string, liveValues: FormLiveValues): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return '';
  const document = new DOMParser().parseFromString(html, 'text/html');

  for (const element of Array.from(document.body.querySelectorAll(CONTROL_SELECTOR))) {
    const identifier = element.getAttribute('id')?.trim() || controlIdentifier(element);
    if (!identifier || !(identifier in liveValues)) continue;

    if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'checkbox') {
      if (liveValues[identifier] === true) element.setAttribute('checked', '');
      else element.removeAttribute('checked');
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const value = liveValues[identifier];
      if (typeof value === 'string' || typeof value === 'number') {
        element.setAttribute('value', String(value));
      }
    } else if (element instanceof HTMLSelectElement) {
      const value = liveValues[identifier];
      for (const option of Array.from(element.options)) {
        if (option.value === String(value)) option.setAttribute('selected', '');
        else option.removeAttribute('selected');
      }
    }
  }

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

function valueForControl(control: BeadFormControl, element: HTMLElement): unknown {
  if (control.type === 'radio') {
    if (!control.name) return undefined;
    const checked = element.closest('form')?.querySelector<HTMLInputElement>(
      `input[type=\"radio\"][name=\"${CSS.escape(control.name)}\"]:checked`,
    );
    return checked?.value ?? '';
  }

  if (element instanceof HTMLInputElement) {
    if (control.type === 'checkbox') return element.checked;
    if (control.type === 'number' || control.type === 'range') return element.value === '' ? '' : Number(element.value);
    return element.value;
  }
  if (element instanceof HTMLTextAreaElement) return element.value;
  if (element instanceof HTMLSelectElement) {
    if (control.multiple || element.multiple) {
      return Array.from(element.selectedOptions).map((option) => option.value);
    }
    return element.value;
  }
  return undefined;
}

export function formElementToValues(form: HTMLFormElement, controls?: BeadFormControl[]): Record<string, unknown> {
  if (controls && controls.length > 0) {
    const values: Record<string, unknown> = {};
    for (const control of controls) {
      const element = control.type === 'radio'
        ? form.querySelector<HTMLElement>(`input[type=\"radio\"][name=\"${CSS.escape(control.name ?? '')}\"]`)
        : form.querySelector<HTMLElement>(`#${CSS.escape(control.id)}`);
      if (!element) continue;
      const value = valueForControl(control, element);
      if (value !== undefined) values[control.id] = value;
    }
    return values;
  }

  const values = formDataToValues(new FormData(form));

  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement)) continue;
    if (element.type.toLowerCase() !== 'checkbox') continue;
    const identifier = element.id.trim() || element.name.trim();
    if (!identifier || identifier.startsWith('__beadsWeb_')) continue;
    values[identifier] = element.checked;
  }

  return values;
}

export function setFormLiveValue(
  metadata: unknown,
  formId: string,
  identifier: string,
  value: unknown,
): JsonObject {
  return setFormLiveValues(metadata, formId, { [identifier]: value });
}

export function setFormLiveValues(
  metadata: unknown,
  formId: string,
  liveValues: FormLiveValues,
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

  if (!isObject(form.liveValues)) form.liveValues = {};
  Object.assign(form.liveValues as JsonObject, liveValues);
  return next;
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
