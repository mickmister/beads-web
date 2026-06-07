"use client";

import { useMemo, useState } from "react";

import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import {
  getBeadForms,
  getFormInitialValues,
  mergeFormResponse,
  validateFormResponse,
  type BeadForm,
  type BeadFormBlock,
} from "@/lib/bead-forms";
import { cn } from "@/lib/utils";
import type { Bead } from "@/types";

interface BeadFormsSectionProps {
  bead: Bead;
  projectPath?: string;
  onUpdate?: () => void;
}

interface BeadFormRendererProps {
  bead: Bead;
  form: BeadForm;
  projectPath?: string;
  onUpdate?: () => void;
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeIssues = (error as { issues?: Array<{ message?: string }> }).issues;
  return maybeIssues?.[0]?.message;
}

function FormControl({
  block,
  value,
  error,
  onChange,
}: {
  block: Exclude<BeadFormBlock, { type: "markdown" }>;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const controlId = `bead-form-${block.name}`;
  const describedBy = block.description || error ? `${controlId}-help` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={controlId} className="block text-sm font-medium text-t-secondary">
        {block.label}
        {block.required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
      </label>

      {block.type === "text" && (
        <Input
          id={controlId}
          value={typeof value === "string" ? value : ""}
          placeholder={block.placeholder}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {block.type === "textarea" && (
        <textarea
          id={controlId}
          value={typeof value === "string" ? value : ""}
          placeholder={block.placeholder}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            error && "border-danger"
          )}
        />
      )}

      {block.type === "checkbox" && (
        <label className="flex items-center gap-2 text-sm text-t-tertiary">
          <input
            id={controlId}
            type="checkbox"
            checked={Boolean(value)}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            onChange={(event) => onChange(event.target.checked)}
            className="size-4 rounded border-b-default accent-info"
          />
          <span>{block.description ?? "Yes"}</span>
        </label>
      )}

      {block.type === "select" && (
        <select
          id={controlId}
          value={typeof value === "string" ? value : ""}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-surface-base px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            error && "border-danger"
          )}
        >
          <option value="">{block.placeholder ?? "Select an option…"}</option>
          {block.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      )}

      {block.type === "radio" && (
        <div className="space-y-1" role="radiogroup" aria-describedby={describedBy} aria-invalid={!!error}>
          {block.options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-t-tertiary">
              <input
                type="radio"
                name={block.name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="size-4 border-b-default accent-info"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}

      {block.type === "number" && (
        <Input
          id={controlId}
          type="number"
          value={typeof value === "number" || typeof value === "string" ? value : ""}
          min={block.min}
          max={block.max}
          placeholder={block.placeholder}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {(block.description || error) && block.type !== "checkbox" && (
        <p id={describedBy} className={cn("text-xs", error ? "text-danger" : "text-t-muted")}>
          {error ?? block.description}
        </p>
      )}
      {error && block.type === "checkbox" && (
        <p id={describedBy} className="text-xs text-danger">{error}</p>
      )}
    </div>
  );
}

function BeadFormRenderer({ bead, form, projectPath, onUpdate }: BeadFormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => getFormInitialValues(form));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const latestResponse = form.responses?.at(-1);
  const canSubmit = !!projectPath;

  const setFieldValue = (name: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectPath) return;

    const parsed = validateFormResponse(form, values);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      toast({ variant: "destructive", title: "Form is incomplete", description: getErrorMessage(parsed.error) });
      return;
    }

    setIsSubmitting(true);
    try {
      const metadata = mergeFormResponse(bead.metadata ?? {}, form.id, parsed.data);
      await api.beads.updateMetadata({ path: projectPath, id: bead.id, metadata });
      toast({ title: "Form submitted", description: `${form.title} response was saved.` });
      onUpdate?.();
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to submit form", description: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-b-default bg-surface-raised/50 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-t-secondary">{form.title}</h4>
        {form.description && <p className="mt-1 text-xs text-t-muted">{form.description}</p>}
        {latestResponse && (
          <p className="mt-1 text-xs text-t-muted">
            Last submitted by {latestResponse.submittedBy} at {latestResponse.submittedAt}
          </p>
        )}
      </div>

      {form.blocks.map((block, index) => {
        if (block.type === "markdown") {
          return (
            <div key={`markdown-${index}`} className="prose prose-sm max-w-none dark:prose-invert text-t-tertiary">
              <ReactMarkdown>{block.markdown}</ReactMarkdown>
            </div>
          );
        }

        return (
          <FormControl
            key={block.name}
            block={block}
            value={values[block.name]}
            error={errors[block.name]}
            onChange={(value) => setFieldValue(block.name, value)}
          />
        );
      })}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </form>
  );
}

export function BeadFormsSection({ bead, projectPath, onUpdate }: BeadFormsSectionProps) {
  const forms = useMemo(() => getBeadForms(bead), [bead]);

  if (forms.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold mb-2 text-t-secondary">Forms</h3>
      <div className="h-px bg-b-default mb-3" />
      <div className="space-y-3">
        {forms.map((form) => (
          <BeadFormRenderer key={form.id} bead={bead} form={form} projectPath={projectPath} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}
