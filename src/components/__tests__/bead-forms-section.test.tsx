import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { Bead } from '@/types';

import { BeadFormsSection } from '../bead-forms-section';

const submitForm = vi.fn().mockResolvedValue({ success: true, webhookMarkdown: '**Thanks**' });
const updateMetadata = vi.fn().mockResolvedValue({ success: true });
const updateFormLiveValue = vi.fn().mockResolvedValue({ success: true });
const toast = vi.fn();

vi.mock('@/lib/api', () => ({
  beads: {
    submitForm: (...args: unknown[]) => submitForm(...args),
    updateMetadata: (...args: unknown[]) => updateMetadata(...args),
    updateFormLiveValue: (...args: unknown[]) => updateFormLiveValue(...args),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

const bead: Bead = {
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
  metadata: {
    beadsWeb: {
      forms: [
        {
          id: 'review',
          title: 'Review form',
          html: '<form><h2>Context</h2><label for="comment">Comment</label><textarea id="comment" name="comment" required></textarea><button type="submit">Send</button></form>',
          controls: [{ id: 'comment', name: 'comment', type: 'textarea', required: true }],
          responses: [],
        },
      ],
    },
  },
};

beforeEach(() => {
  submitForm.mockClear();
  updateMetadata.mockClear();
  updateFormLiveValue.mockClear();
  toast.mockClear();
});

describe('BeadFormsSection', () => {
  it('renders sanitized HTML forms from bead metadata', () => {
    render(<BeadFormsSection bead={bead} projectPath="/project" />);

    expect(screen.getByText('Review form')).toBeInTheDocument();
    expect(screen.getByText('Context')).toBeInTheDocument();
    expect(screen.getByLabelText(/Comment/)).toBeInTheDocument();
  });

  it('submits form values to the beads form endpoint and renders webhook markdown', async () => {
    const onUpdate = vi.fn();
    render(<BeadFormsSection bead={bead} projectPath="/project" onUpdate={onUpdate} />);

    fireEvent.change(screen.getByLabelText(/Comment/), { target: { value: 'Looks good' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(submitForm).toHaveBeenCalledTimes(1));
    expect(submitForm).toHaveBeenCalledWith({
      path: '/project',
      id: 'bd-1',
      formId: 'review',
      values: { comment: 'Looks good' },
    });
    expect(await screen.findByText('Thanks')).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalled();
  });

  it('persists live checkbox state to metadata', async () => {
    const checkboxBead: Bead = {
      ...bead,
      metadata: {
        beadsWeb: {
          forms: [
            {
              id: 'review',
              title: 'Review form',
              html: '<form><label><input id="ack" name="ack" type="checkbox"> Ack</label><button type="submit">Send</button></form>',
              controls: [{ id: 'ack', name: 'ack', type: 'checkbox', live: true }],
              responses: [],
            },
          ],
        },
      },
    };
    const onUpdate = vi.fn();

    render(<BeadFormsSection bead={checkboxBead} projectPath="/project" onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Ack/ }));

    await waitFor(() => expect(updateFormLiveValue).toHaveBeenCalledTimes(1));
    expect(updateFormLiveValue).toHaveBeenCalledWith({
      path: '/project',
      id: 'bd-1',
      formId: 'review',
      controlId: 'ack',
      value: true,
    });
    expect(updateMetadata).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalled();
  });
});
