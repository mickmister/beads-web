import { z } from 'zod/v4';

import type { Bead } from '@/types';

export type JsonObject = Record<string, unknown>;

const FormOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

const BaseControlSchema = z.object({
  name: z.string().min(1).regex(/^[A-Za-z_][A-Za-z0-9_-]*$/),
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
});

const MarkdownBlockSchema = z.object({
  type: z.literal('markdown'),
  markdown: z.string(),
});

const TextBlockSchema = BaseControlSchema.extend({
  type: z.literal('text'),
  placeholder: z.string().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
});

const TextareaBlockSchema = BaseControlSchema.extend({
  type: z.literal('textarea'),
  placeholder: z.string().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
});

const CheckboxBlockSchema = BaseControlSchema.extend({
  type: z.literal('checkbox'),
});

const ChoiceBlockSchema = BaseControlSchema.extend({
  type: z.union([z.literal('select'), z.literal('radio')]),
  options: z.array(FormOptionSchema).min(1),
  placeholder: z.string().optional(),
});

const NumberBlockSchema = BaseControlSchema.extend({
  type: z.literal('number'),
  placeholder: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const BeadFormBlockSchema = z.discriminatedUnion('type', [
  MarkdownBlockSchema,
  TextBlockSchema,
  TextareaBlockSchema,
  CheckboxBlockSchema,
  ChoiceBlockSchema,
  NumberBlockSchema,
]);

export const BeadFormResponseSchema = z.object({
  submittedBy: z.string().min(1),
  submittedAt: z.string().min(1),
  values: z.record(z.string(), z.unknown()),
});

const BeadFormBaseSchema = z.object({
  id: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().min(1),
  description: z.string().optional(),
  version: z.number().int().positive().optional(),
  blocks: z.array(BeadFormBlockSchema).min(1),
  responseSchema: z.record(z.string(), z.unknown()).optional(),
  responses: z.array(BeadFormResponseSchema).optional(),
});

export const BeadFormSchema = BeadFormBaseSchema.superRefine((form, ctx) => {
  const names = new Set<string>();
  for (const block of form.blocks) {
    if (block.type === 'markdown') continue;
    if (names.has(block.name)) {
      ctx.addIssue({
        code: 'custom',
        path: ['blocks'],
        message: `Duplicate form control name: ${block.name}`,
      });
    }
    names.add(block.name);
  }
});

export const BeadsWebMetadataSchema = z.object({
  forms: z.array(BeadFormSchema).optional(),
}).passthrough();

export type FormOption = z.infer<typeof FormOptionSchema>;
export type BeadFormBlock = z.infer<typeof BeadFormBlockSchema>;
export type BeadForm = z.infer<typeof BeadFormSchema>;
export type BeadFormResponse = z.infer<typeof BeadFormResponseSchema>;

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function getBeadForms(bead: Pick<Bead, 'metadata'>): BeadForm[] {
  const metadata = bead.metadata;
  if (!isObject(metadata) || !isObject(metadata.beadsWeb)) return [];

  const parsed = BeadsWebMetadataSchema.safeParse(metadata.beadsWeb);
  if (!parsed.success) return [];

  return parsed.data.forms ?? [];
}

function stringSchemaFor(block: Extract<BeadFormBlock, { type: 'text' | 'textarea' }>): z.ZodTypeAny {
  let schema = z.string();
  if (block.required) schema = schema.trim().min(1, `${block.label} is required`);
  if (block.minLength !== undefined) schema = schema.min(block.minLength);
  if (block.maxLength !== undefined) schema = schema.max(block.maxLength);
  return block.required ? schema : schema.optional().or(z.literal(''));
}

function schemaForBlock(block: Exclude<BeadFormBlock, { type: 'markdown' }>): z.ZodTypeAny {
  switch (block.type) {
    case 'text':
    case 'textarea':
      return stringSchemaFor(block);
    case 'checkbox':
      return block.required ? z.boolean() : z.boolean().optional();
    case 'select':
    case 'radio': {
      const values = block.options.map((option) => option.value);
      const schema = z.string().refine((value) => values.includes(value), `${block.label} must be one of the available options`);
      return block.required ? schema : schema.optional().or(z.literal(''));
    }
    case 'number': {
      let schema = z.coerce.number();
      if (block.min !== undefined) schema = schema.min(block.min);
      if (block.max !== undefined) schema = schema.max(block.max);
      return block.required ? schema : schema.optional();
    }
  }
}

export function createFormResponseSchema(form: BeadForm): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const block of form.blocks) {
    if (block.type === 'markdown') continue;
    shape[block.name] = schemaForBlock(block);
  }
  return z.object(shape).strict();
}

export function createFormResponseJsonSchema(form: BeadForm): unknown {
  return z.toJSONSchema(createFormResponseSchema(form), { target: 'draft-2020-12', io: 'input' });
}

export function validateFormResponse(form: BeadForm, values: Record<string, unknown>) {
  return createFormResponseSchema(form).safeParse(values);
}

export function getFormInitialValues(form: BeadForm): Record<string, unknown> {
  const latest = form.responses?.at(-1)?.values;
  if (latest && isObject(latest)) return { ...latest };

  const initial: Record<string, unknown> = {};
  for (const block of form.blocks) {
    if (block.type === 'markdown') continue;
    if (block.default !== undefined) initial[block.name] = block.default;
    else if (block.type === 'checkbox') initial[block.name] = false;
    else initial[block.name] = '';
  }
  return initial;
}

export function mergeFormResponse(
  metadata: unknown,
  formId: string,
  values: Record<string, unknown>,
  submittedAt: string = new Date().toISOString(),
  submittedBy = 'user'
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
  responses.push({ submittedBy, submittedAt, values });
  return next;
}
