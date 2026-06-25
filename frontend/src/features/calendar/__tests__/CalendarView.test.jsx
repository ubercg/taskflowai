import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';

// 1. Setup global mocks before importing components
vi.mock('../../../services/api', () => ({
  getCalendarTasks: vi.fn(),
  // Usadas por CalendarPdfReport (bloque de metricas del PDF)
  getFlowMetrics: vi.fn().mockResolvedValue({}),
  getTasks: vi.fn().mockResolvedValue([]),
  // Slice 3 renamed: getVelocity (projectId-scoped) replaces getVelocityMetrics
  getVelocity: vi.fn().mockResolvedValue([]),
  // Alias preserved for backward compat — must also be mocked so imports don't break
  getVelocityMetrics: vi.fn().mockResolvedValue([]),
  getAgingMetrics: vi.fn().mockResolvedValue([]),
  getBurndown: vi.fn().mockResolvedValue([]),
  getObjectives: vi.fn().mockResolvedValue([]),
}));

import { SWRConfig } from 'swr';
import CalendarView from '../CalendarView';
import { getCalendarTasks, getVelocity, getBurndown } from '../../../services/api';

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

  it('renders a task on its exact due_date cell despite UTC-midnight timestamps (timezone regression)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 16)); // June 16, 2026

    // Saturday June 27 at UTC midnight: with naive `new Date()` parsing this
    // shifts to Friday June 26 in negative-offset timezones. parseDateOnly must
    // keep it anchored to the calendar day (27).
    const mockTasks = [
      { id: 7, title: 'Weekend Task', status: 'todo', due_date: '2026-06-27T00:00:00Z' },
    ];
    getCalendarTasks.mockResolvedValueOnce(mockTasks);

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CalendarView projectId={99} />
      </SWRConfig>
    );

    // Wait for the grid to paint the task somewhere
    const taskNode = await screen.findByText('Weekend Task');

    // The day cell holds a "27 JUN" label as its first child; the task must live
    // inside that same cell, not in the "26 JUN" (Friday) cell.
    const saturdayCell = screen.getByText('27 JUN').parentElement;
    const fridayCell = screen.getByText('26 JUN').parentElement;

    expect(within(saturdayCell).getByText('Weekend Task')).toBeInTheDocument();
    expect(within(fridayCell).queryByText('Weekend Task')).not.toBeInTheDocument();
    expect(saturdayCell.contains(taskNode)).toBe(true);
  });

  it('mounts the metrics report and prints once its data is ready', async () => {
    getCalendarTasks.mockResolvedValueOnce([]);
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CalendarView projectId={99} />
      </SWRConfig>
    );

    const exportBtn = await screen.findByRole('button', { name: /exportar pdf/i });

    // The printable region must be flagged so the print stylesheet can isolate it.
    expect(document.querySelector('.calendar-print-area')).toBeInTheDocument();

    fireEvent.click(exportBtn);

    // The metrics report is mounted off-screen for the PDF.
    expect(await screen.findByText('Métricas del Proyecto')).toBeInTheDocument();
    expect(document.querySelector('.calendar-pdf-report')).toBeInTheDocument();

    // print() fires only after the report signals its data is ready.
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

    printSpy.mockRestore();
  });

  it('passes a half-open metrics range (first-of-next-month as end) to velocity and burndown, while calendar-tasks still use the inclusive end-of-month', async () => {
    // Guard for the date-convention off-by-one: metrics endpoints need [start, end)
    // where end = first day of next month (exclusive upper bound), NOT end-of-month.
    // The calendar-tasks endpoint remains day-inclusive (endOfMonth).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 16)); // June 16, 2026

    getCalendarTasks.mockResolvedValue([]);

    const projectId = 42;

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CalendarView projectId={projectId} />
      </SWRConfig>
    );

    // Trigger PDF export so CalendarPdfReport mounts and its SWR hooks fire
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const exportBtn = await screen.findByRole('button', { name: /exportar pdf/i });
    fireEvent.click(exportBtn);

    // Wait for the report to appear (CalendarPdfReport mounted)
    await screen.findByText('Métricas del Proyecto');

    // Half-open range for metrics: start = 2026-06-01, end = 2026-07-01 (first of next month)
    const metricsStart = format(startOfMonth(new Date(2026, 5, 16)), 'yyyy-MM-dd'); // '2026-06-01'
    const metricsEnd = format(startOfMonth(addMonths(new Date(2026, 5, 16), 1)), 'yyyy-MM-dd'); // '2026-07-01'

    await waitFor(() => {
      expect(getVelocity).toHaveBeenCalledWith(projectId, metricsStart, metricsEnd);
    });
    await waitFor(() => {
      expect(getBurndown).toHaveBeenCalledWith(projectId, metricsStart, metricsEnd);
    });

    // Calendar-tasks must still use the inclusive end-of-month (2026-06-30), NOT 2026-07-01
    const calendarEnd = format(endOfMonth(new Date(2026, 5, 16)), 'yyyy-MM-dd'); // '2026-06-30'
    expect(getCalendarTasks).toHaveBeenCalledWith(projectId, metricsStart, calendarEnd);
    // Explicitly assert it was NOT called with the half-open end
    expect(getCalendarTasks).not.toHaveBeenCalledWith(projectId, metricsStart, metricsEnd);

    printSpy.mockRestore();
  });

  it('keeps every task of a day in the DOM so the PDF can expand beyond the on-screen limit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 16)); // June 16, 2026

    // Five tasks on the same day: 3 visible on screen, the rest live in a
    // print-only container that the print stylesheet expands.
    const mockTasks = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      title: `Daily Task ${i + 1}`,
      status: 'todo',
      due_date: '2026-06-16T12:00:00Z',
    }));
    getCalendarTasks.mockResolvedValueOnce(mockTasks);

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CalendarView projectId={99} />
      </SWRConfig>
    );

    // All five tasks must exist in the DOM, even the overflowed ones.
    await screen.findByText('Daily Task 1');
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(`Daily Task ${i}`)).toBeInTheDocument();
    }

    // The overflow tasks sit inside the print-only container.
    const printOnly = document.querySelector('.calendar-print-only-tasks');
    expect(printOnly).toBeInTheDocument();
    expect(within(printOnly).getByText('Daily Task 4')).toBeInTheDocument();
    expect(within(printOnly).getByText('Daily Task 5')).toBeInTheDocument();

    // The "+N más" badge is hidden from the PDF.
    const moreBadge = screen.getByText('+2 más');
    expect(moreBadge).toHaveClass('calendar-no-print');
  });
});
