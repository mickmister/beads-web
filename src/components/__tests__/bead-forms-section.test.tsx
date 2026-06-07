import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { Bead } from '@/types';

import { BeadFormsSection } from '../bead-forms-section';

const updateMetadata = vi.fn().mockResolvedValue({ success: true });
const toast = vi.fn();

vi.mock('@/lib/api', () => ({
  beads: {
    updateMetadata: (...args: unknown[]) => updateMetadata(...args),
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
          blocks: [
            { type: 'markdown', markdown: '## Context' },
            { type: 'textarea', name: 'comment', label: 'Comment', required: true },
          ],
          responses: [],
        },
      ],
    },
  },
};

beforeEach(() => {
  updateMetadata.mockClear();
  toast.mockClear();
});

describe('BeadFormsSection', () => {
  it('renders markdown and controls from bead metadata', () => {
    render(<BeadFormsSection bead={bead} projectPath="/project" />);

    expect(screen.getByText('Review form')).toBeInTheDocument();
    expect(screen.getByText('Context')).toBeInTheDocument();
    expect(screen.getByLabelText(/Comment/)).toBeInTheDocument();
  });

  it('appends a response to metadata on submit', async () => {
    const onUpdate = vi.fn();
    render(<BeadFormsSection bead={bead} projectPath="/project" onUpdate={onUpdate} />);

    fireEvent.change(screen.getByLabelText(/Comment/), { target: { value: 'Looks good' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(updateMetadata).toHaveBeenCalledTimes(1));
    expect(updateMetadata.mock.calls[0][0]).toMatchObject({
      path: '/project',
      id: 'bd-1',
      metadata: {
        beadsWeb: {
          forms: [
            {
              id: 'review',
              responses: [
                {
                  submittedBy: 'user',
                  values: { comment: 'Looks good' },
                },
              ],
            },
          ],
        },
      },
    });
    expect(onUpdate).toHaveBeenCalled();
  });
});
