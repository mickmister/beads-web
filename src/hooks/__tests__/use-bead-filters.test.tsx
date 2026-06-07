import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Bead } from '@/types';

import { useBeadFilters } from '../use-bead-filters';

const bead = (id: string, assignee?: string): Bead => ({
  id,
  title: id,
  status: 'open',
  priority: 2,
  issue_type: 'task',
  owner: 'agent',
  assignee,
  created_at: '2026-06-07T00:00:00Z',
  updated_at: '2026-06-07T00:00:00Z',
  comments: [],
});

describe('useBeadFilters', () => {
  it('filters My board to beads assigned to user', () => {
    const beads = [bead('mine', 'user'), bead('agent-task', 'agent'), bead('unassigned')];
    const { result } = renderHook(() => useBeadFilters(beads, new Map()));

    act(() => result.current.setFilters({ myBoardOnly: true }));

    expect(result.current.filteredBeads.map((b) => b.id)).toEqual(['mine']);
  });
});
