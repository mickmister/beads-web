import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { Bead } from '@/types';

import { BeadFormsSection } from '../bead-forms-section';

const submitForm = vi.fn().mockResolvedValue({ success: true, webhookMarkdown: '**Thanks**' });
const toast = vi.fn();

vi.mock('@/lib/api', () => ({
  beads: {
    submitForm: (...args: unknown[]) => submitForm(...args),
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
          html: '<form><h2>Context</h2><label>Comment<textarea name="comment" required></textarea></label><button type="submit">Send</button></form>',
          responses: [],
        },
      ],
    },
  },
};

beforeEach(() => {
  submitForm.mockClear();
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
});
