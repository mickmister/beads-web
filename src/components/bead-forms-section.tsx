"use client";

import { useMemo, useState } from "react";

import ReactMarkdown from "react-markdown";

import { toast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import {
  formDataToValues,
  getBeadForms,
  sanitizeFormHtml,
  type BeadForm,
} from "@/lib/bead-forms";
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

function BeadFormRenderer({ bead, form, projectPath, onUpdate }: BeadFormRendererProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [webhookMarkdown, setWebhookMarkdown] = useState<string | null>(form.responses?.at(-1)?.webhookMarkdown ?? null);
  const latestResponse = form.responses?.at(-1);
  const canSubmit = !!projectPath;
  const sanitizedHtml = useMemo(() => sanitizeFormHtml(form.html), [form.html]);

  const handleSubmit = async (event: React.FormEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) return;

    event.preventDefault();
    if (!projectPath) return;

    if (!target.reportValidity()) return;

    const values = formDataToValues(new FormData(target));
    setIsSubmitting(true);
    try {
      const response = await api.beads.submitForm({
        path: projectPath,
        id: bead.id,
        formId: form.id,
        values,
      });
      setWebhookMarkdown(response.webhookMarkdown ?? null);
      toast({ title: "Form submitted", description: `${form.title} response was saved.` });
      onUpdate?.();
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to submit form", description: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-b-default bg-surface-raised/50 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-t-secondary">{form.title}</h4>
        {form.description && <p className="mt-1 text-xs text-t-muted">{form.description}</p>}
        {latestResponse && (
          <p className="mt-1 text-xs text-t-muted">
            Last submitted by {latestResponse.submittedBy} at {latestResponse.submittedAt}
          </p>
        )}
      </div>

      <div
        className="beads-html-form prose prose-sm max-w-none dark:prose-invert text-t-tertiary"
        onSubmit={handleSubmit}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />

      {!canSubmit && (
        <p className="text-xs text-t-muted">Open this bead from a project to submit the form.</p>
      )}
      {isSubmitting && <p className="text-xs text-t-muted">Submitting…</p>}
      {webhookMarkdown && (
        <div className="rounded-md border border-b-default bg-surface-base/60 p-3">
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-t-muted">Response</h5>
          <div className="prose prose-sm max-w-none dark:prose-invert text-t-tertiary">
            <ReactMarkdown>{webhookMarkdown}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
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
