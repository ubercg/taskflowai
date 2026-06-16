import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

// 1. Setup global mocks before importing components
vi.mock('../../../services/api', () => ({
  getCalendarTasks: vi.fn(),
}));

import { SWRConfig } from 'swr';
import CalendarView from '../CalendarView';
import { getCalendarTasks } from '../../../services/api';

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays a message if no project is selected', () => {
    render(<CalendarView projectId={null} />);
    expect(screen.getByText('Por favor selecciona un proyecto para ver el calendario.')).toBeInTheDocument();
  });

  it('fetches tasks for the visible month range and renders components', async () => {
    // Fix current time to avoid timezone/month boundary flakiness
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 16)); // June 16, 2026

    const mockTasks = [
      { id: 1, title: 'Task 1', status: 'todo', due_date: '2026-06-16T15:00:00Z' },
      { id: 2, title: 'Task 2', status: 'in_progress', due_date: '2026-06-20T10:00:00Z' },
    ];

    getCalendarTasks.mockResolvedValueOnce(mockTasks);

    const projectId = 99;
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CalendarView projectId={projectId} />
      </SWRConfig>
    );

    // Renders the CalendarView shell
    expect(screen.getByText('Calendario del Proyecto')).toBeInTheDocument();
    
    // Calculates range correctly
    const expectedStart = format(startOfMonth(new Date(2026, 5, 16)), 'yyyy-MM-dd');
    const expectedEnd = format(endOfMonth(new Date(2026, 5, 16)), 'yyyy-MM-dd');

    // Wait for SWR fetcher to have been called with correct arguments
    await waitFor(() => {
      expect(getCalendarTasks).toHaveBeenCalledWith(projectId, expectedStart, expectedEnd);
    });

    // Check if tasks are passed down to sidebar (Task 1 falls on June 16, which is selected by default in mock)
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
  });
});
