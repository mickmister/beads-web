import { describe, expect, it } from 'vitest';

import type { Bead } from '@/types';

import {
  formDataToValues,
  formElementToValues,
  getFormControlManifestErrors,
  getFormIdentifierErrors,
  getBeadForms,
  mergeFormResponse,
  setFormLiveValue,
  sanitizeFormHtml,
} from '../bead-forms';

const baseBead: Bead = {
  id: 'bd-1',
  title: 'Review feedback',
  status: 'open',
  priority: 2,
  issue_type: 'task',
  owner: 'agent',
  assignee: 'user',
  created_at: '2026-06-07T00:00:00Z',
  updated_at: '2026-06-07T00:00:00Z',
  comments: [],
};

describe('bead HTML forms', () => {
  it('extracts valid HTML forms from bead metadata', () => {
    const bead: Bead = {
      ...baseBead,
      metadata: {
        beadsWeb: {
          forms: [
            {
              id: 'review',
              title: 'Review',
              html: '<form><label>Comment<textarea name="comment" required></textarea></label><button>Submit</button></form>',
              controls: [{ id: 'comment', name: 'comment', type: 'textarea', required: true }],
            },
          ],
        },
      },
    };

    const forms = getBeadForms(bead);

    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe('review');
    expect(forms[0].html).toContain('<form>');
  });

  it('ignores legacy block DSL-only forms', () => {
    const bead: Bead = {
      ...baseBead,
      metadata: {
        beadsWeb: {
          forms: [
            {
              id: 'review',
              title: 'Review',
              blocks: [{ type: 'textarea', name: 'comment', label: 'Comment' }],
            },
          ],
        },
      },
    };

    expect(getBeadForms(bead)).toHaveLength(0);
  });

  it('sanitizes scripts, event handlers, external resources, and unsafe styles', () => {
    const sanitized = sanitizeFormHtml(`
      <form action="https://evil.example/post" method="get">
        <script>alert(1)</script>
        <img src="https://evil.example/tracker.png">
        <input name="comment" onclick="alert(1)" style="color: red; background-image: url(javascript:alert(1)); position: fixed">
        <a href="javascript:alert(1)">bad link</a>
      </form>
    `);

    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('<img');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('position');
    expect(sanitized).toContain('style="color: red"');
    expect(sanitized).toContain('action="/api/beads/forms/submit"');
    expect(sanitized).toContain('method="post"');
  });

  it('converts FormData to response values with arrays for repeated fields', () => {
    const formData = new FormData();
    formData.append('comment', 'LGTM');
    formData.append('labels', 'one');
    formData.append('labels', 'two');
    formData.append('__beadsWeb_formId', 'review');

    expect(formDataToValues(formData)).toEqual({
      comment: 'LGTM',
      labels: ['one', 'two'],
    });
  });

  it('requires stable unique identifiers for form controls', () => {
    expect(getFormIdentifierErrors('<form><input><textarea name="comment"></textarea></form>')).toContain(
      'input controls must have a unique id or name',
    );
    expect(getFormIdentifierErrors('<form><input name="same"><textarea name="same"></textarea></form>')).toContain(
      'Duplicate form control identifier "same" on input and textarea',
    );
    expect(getFormIdentifierErrors('<form><input id="first" name="same"><input id="second" name="same"></form>')).toEqual([]);
  });

  it('validates controls manifests against HTML controls', () => {
    expect(getFormControlManifestErrors({
      id: 'review',
      title: 'Review',
      html: '<form><textarea id="comment" name="comment"></textarea></form>',
      controls: [{ id: 'comment', name: 'comment', type: 'textarea' }],
    })).toEqual([]);

    expect(getFormControlManifestErrors({
      id: 'review',
      title: 'Review',
      html: '<form><textarea id="comment" name="comment"></textarea></form>',
    })).toContain('Form metadata must declare controls[] for server-side validation');

    expect(getFormControlManifestErrors({
      id: 'review',
      title: 'Review',
      html: '<form><input id="ack" name="ack" type="checkbox"></form>',
      controls: [{ id: 'ack', name: 'ack', type: 'text' }],
    })).toContain('Control "ack" type mismatch: HTML is "checkbox" but controls[] says "text"');
  });


  it('models radio controls as a string-valued group', () => {
    const formDefinition = {
      id: 'review',
      title: 'Review',
      html: '<form><label><input id="decision-approve" name="decision" type="radio" value="approve"> Approve</label><label><input id="decision-reject" name="decision" type="radio" value="reject" checked> Reject</label></form>',
      controls: [{ id: 'decision', name: 'decision', type: 'radio' as const, required: true }],
    };

    expect(getFormControlManifestErrors(formDefinition)).toEqual([]);

    document.body.innerHTML = formDefinition.html;
    const form = document.querySelector('form')!;

    expect(formElementToValues(form, formDefinition.controls)).toEqual({
      decision: 'reject',
    });
  });

  it('uses unique identifiers when collecting checkbox values', () => {
    document.body.innerHTML = '<form><input id="reviewed" name="reviewed" type="checkbox" checked><input id="comment" name="comment" value="done"></form>';
    const form = document.querySelector('form')!;

    expect(formElementToValues(form, [
      { id: 'reviewed', name: 'reviewed', type: 'checkbox' },
      { id: 'comment', name: 'comment', type: 'text' },
    ])).toEqual({
      reviewed: true,
      comment: 'done',
    });
  });

  it('stores live control values in form metadata', () => {
    const metadata = {
      beadsWeb: {
        forms: [
            {
              id: 'review',
              title: 'Review',
              html: '<form><input id="reviewed" type="checkbox"></form>',
              controls: [{ id: 'reviewed', name: 'reviewed', type: 'checkbox', live: true }],
            },
        ],
      },
    };

    const next = setFormLiveValue(metadata, 'review', 'reviewed', true);

    expect((next as any).beadsWeb.forms[0].liveValues).toEqual({ reviewed: true });
  });

  it('appends response history while preserving unrelated metadata', () => {
    const metadata = {
      untouched: true,
      beadsWeb: {
        forms: [
          {
            id: 'review',
            title: 'Review',
            html: '<form><textarea name="comment"></textarea></form>',
            controls: [{ id: 'comment', name: 'comment', type: 'textarea' }],
            responses: [{ submittedBy: 'user', submittedAt: 'old', values: { comment: 'old' } }],
          },
        ],
      },
    };

    const next = mergeFormResponse(metadata, 'review', { comment: 'new' }, '2026-06-07T00:00:00Z', 'user', '**Thanks**');
    const form = (next as any).beadsWeb.forms[0];

    expect((next as any).untouched).toBe(true);
    expect(form.responses).toHaveLength(2);
    expect(form.responses[1]).toEqual({
      submittedBy: 'user',
      submittedAt: '2026-06-07T00:00:00Z',
      values: { comment: 'new' },
      webhookMarkdown: '**Thanks**',
    });
  });
});
