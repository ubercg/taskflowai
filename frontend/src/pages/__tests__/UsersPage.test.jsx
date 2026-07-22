import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

// Mock SWR before component imports
vi.mock('swr', () => ({
  default: vi.fn(),
}));

// Mock api module — we want to assert getTeamVelocity is called,
// NOT getVelocityMetrics.
vi.mock('../../services/api', () => ({
  getUsers: vi.fn(),
  getTeamVelocity: vi.fn(),
  // Explicitly NOT exporting getVelocityMetrics here to catch wrong import
}));

// Mock heavy child components so jsdom doesn't choke on complex rendering
vi.mock('../../components/users/UserCard', () => ({
  default: ({ user }) => <div data-testid={`user-card-${user.id}`}>{user.name}</div>,
}));

vi.mock('../../components/users/NewUserModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="new-user-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import useSWR from 'swr';
import { getTeamVelocity, getUsers } from '../../services/api';
import UsersPage from '../UsersPage';
import i18n from '../../i18n';

const mockUsers = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'developer', color: '#6366f1', is_active: true },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'manager', color: '#22c55e', is_active: true },
];

const mockVelocity = [
  { user_id: 1, name: 'Alice', color: '#6366f1', in_progress: 2, completed: 5, total_hours: 40 },
  { user_id: 2, name: 'Bob', color: '#22c55e', in_progress: 1, completed: 3, total_hours: 24 },
];

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // SWR mock: return data based on key
    useSWR.mockImplementation((key, fetcher, options) => {
      if (key === '/api/v1/users') {
        return { data: mockUsers, error: undefined, mutate: vi.fn() };
      }
      if (key === '/api/v1/metrics/velocity/team') {
        return { data: mockVelocity, error: undefined };
      }
      return { data: undefined, error: undefined, mutate: vi.fn() };
    });
  });

  it('renders a user card for each user', () => {
    render(<UsersPage />);
    expect(screen.getByTestId('user-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('user-card-2')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('calls getTeamVelocity (NOT getVelocityMetrics) as SWR fetcher', () => {
    render(<UsersPage />);

    // SWR must have been called with the team velocity key
    const calls = useSWR.mock.calls;
    const teamVelCall = calls.find(([key]) => key === '/api/v1/metrics/velocity/team');
    expect(teamVelCall).toBeDefined();

    // The fetcher passed to SWR for the team velocity key must reference getTeamVelocity
    // We verify by checking that getTeamVelocity is the function reference used
    const [, fetcher] = teamVelCall;
    expect(typeof fetcher).toBe('function');
    // Call the fetcher and verify it invokes getTeamVelocity
    getTeamVelocity.mockResolvedValueOnce(mockVelocity);
    fetcher();
    expect(getTeamVelocity).toHaveBeenCalledTimes(1);
  });

  it('does NOT call getVelocityMetrics', () => {
    render(<UsersPage />);
    // getVelocityMetrics is not in our mock, so if it was called it would error.
    // The real check: our SWR calls must not reference velocity without "/team"
    const calls = useSWR.mock.calls;
    const nonTeamVelCall = calls.find(
      ([key]) => key === '/api/v1/metrics/velocity' && typeof key === 'string'
    );
    expect(nonTeamVelCall).toBeUndefined();
  });

  it('shows loading state while users are not yet available', () => {
    useSWR.mockImplementation((key) => {
      if (key === '/api/v1/users') return { data: undefined, error: undefined, mutate: vi.fn() };
      return { data: undefined, error: undefined };
    });
    render(<UsersPage />);
    expect(screen.getByText(i18n.t('users.loading'))).toBeInTheDocument();
  });

  it('shows error state when users fetch fails', () => {
    useSWR.mockImplementation((key) => {
      if (key === '/api/v1/users') {
        return { data: undefined, error: new Error('Network error'), mutate: vi.fn() };
      }
      return { data: undefined, error: undefined };
    });
    render(<UsersPage />);
    expect(screen.getByText(i18n.t('users.loadError'))).toBeInTheDocument();
  });
});
