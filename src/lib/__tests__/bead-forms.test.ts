import { describe, expect, it } from 'vitest';

import type { Bead } from '@/types';

import {
  getBeadForms,
  validateFormResponse,
  mergeFormResponse,
  createFormResponseJsonSchema,
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

describe('bead form DSL', () => {
  it('extracts valid beadsWeb forms from bead metadata', () => {
    const bead: Bead = {
      ...baseBead,
      metadata: {
        beadsWeb: {
          forms: [
            {
              id: 'review',
              title: 'Review',
              blocks: [
                { type: 'markdown', markdown: '## Context' },
                { type: 'textarea', name: 'comment', label: 'Comment', required: true },
              ],
            },
          ],
        },
      },
    };

    const forms = getBeadForms(bead);

    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe('review');
  });

  it('rejects duplicate control names', () => {
    const bead: Bead = {
      ...baseBead,
      metadata: {
        beadsWeb: {
          forms: [
            {
              id: 'review',
              title: 'Review',
              blocks: [
                { type: 'text', name: 'comment', label: 'Comment' },
                { type: 'textarea', name: 'comment', label: 'Comment again' },
              ],
            },
          ],
        },
      },
    };

    expect(getBeadForms(bead)).toHaveLength(0);
  });

  it('validates required controls and select options', () => {
    const form = getBeadForms({
      ...baseBead,
      metadata: {
        beadsWeb: {
          forms: [
            {
              id: 'review',
              title: 'Review',
              blocks: [
                { type: 'textarea', name: 'comment', label: 'Comment', required: true },
                {
                  type: 'select',
                  name: 'decision',
                  label: 'Decision',
                  required: true,
                  options: [
                    { label: 'Approve', value: 'approve' },
                    { label: 'Reject', value: 'reject' },
                  ],
                },
              ],
            },
          ],
        },
      },
    })[0];

    expect(validateFormResponse(form, { comment: '', decision: 'approve' }).success).toBe(false);
    expect(validateFormResponse(form, { comment: 'LGTM', decision: 'maybe' }).success).toBe(false);
    expect(validateFormResponse(form, { comment: 'LGTM', decision: 'approve' }).success).toBe(true);
  });

  it('emits JSON Schema for controls', () => {
    const form = getBeadForms({
      ...baseBead,
      metadata: {
        beadsWeb: {
          forms: [
            {
              id: 'review',
              title: 'Review',
              blocks: [
                { type: 'text', name: 'summary', label: 'Summary', required: true },
                { type: 'checkbox', name: 'approved', label: 'Approved' },
              ],
            },
          ],
        },
      },
    })[0];

    const schema = createFormResponseJsonSchema(form) as any;

    expect(schema.type).toBe('object');
    expect(schema.required).toContain('summary');
    expect(schema.properties.summary.type).toBe('string');
    expect(schema.properties.approved.type).toBe('boolean');
  });

  it('appends response history while preserving unrelated metadata', () => {
    const metadata = {
      untouched: true,
      beadsWeb: {
        forms: [
          {
            id: 'review',
            title: 'Review',
            responses: [{ submittedBy: 'user', submittedAt: 'old', values: { comment: 'old' } }],
            blocks: [{ type: 'textarea', name: 'comment', label: 'Comment' }],
          },
        ],
      },
    };

    const next = mergeFormResponse(metadata, 'review', { comment: 'new' }, '2026-06-07T00:00:00Z');
    const form = (next as any).beadsWeb.forms[0];

    expect((next as any).untouched).toBe(true);
    expect(form.responses).toHaveLength(2);
    expect(form.responses[1]).toEqual({
      submittedBy: 'user',
      submittedAt: '2026-06-07T00:00:00Z',
      values: { comment: 'new' },
    });
  });
});
