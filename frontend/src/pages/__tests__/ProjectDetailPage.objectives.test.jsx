import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock SWR before the component import
vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('../../hooks/usePermissions', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  getProject: vi.fn(),
  getObjectives: vi.fn(),
  getProjectMetrics: vi.fn(),
}));

vi.mock('../../services/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock child components to isolate the page behavior
vi.mock('../../components/projects/ObjectiveFormModal', () => ({
  default: ({ objective, onClose }) => (
    <div data-testid="objective-modal" data-objective-id={objective?.id}>
      <button onClick={onClose}>Close Modal</button>
    </div>
  ),
}));

vi.mock('../../components/projects/ObjectiveTasksPanel', () => ({
  default: () => <div data-testid="tasks-panel" />,
}));

vi.mock('../../components/projects/MembersPanel', () => ({
  default: () => <div data-testid="members-panel" />,
}));

vi.mock('../../components/projects/ProjectFormModal', () => ({
  default: () => <div data-testid="project-form-modal" />,
}));

import useSWR from 'swr';
import usePermissions from '../../hooks/usePermissions';
import ProjectDetailPage from '../ProjectDetailPage';
import i18n from '../../i18n';

const mockProject = {
  id: 1,
  name: 'Test Project',
  description: 'A test project',
  status: 'active',
  color: '#6366f1',
  icon: '🚀',
  created_at: '2026-01-01T00:00:00Z',
};

const mockObjectives = [
  { id: 1, title: 'Objective 1', progress: 50, due_date: '2026-12-31T00:00:00Z', project_id: 1, description: 'Desc 1' },
  { id: 2, title: 'Objective 2', progress: 25, due_date: '2026-12-31T00:00:00Z', project_id: 1, description: null },
];

const renderPage = () => {
  return render(
    <MemoryRouter initialEntries={['/projects/1']}>
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects/:id/board" element={<div>Board</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProjectDetailPage — objective Edit buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    usePermissions.mockReturnValue({ canEditProject: true });

    // SWR mock: return data for each key pattern
    useSWR.mockImplementation((key, fetcher, options) => {
      if (key && key.includes('/projects/1') && !key.includes('members') && !key.includes('metrics')) {
        return { data: mockProject, mutate: vi.fn() };
      }
      if (key && key.includes('objectives')) {
        return { data: mockObjectives, mutate: vi.fn() };
      }
      if (key && key.includes('members')) {
        return { data: [], mutate: vi.fn() };
      }
      if (key && key.includes('metrics')) {
        return { data: [], mutate: vi.fn() };
      }
      return { data: undefined, mutate: vi.fn() };
    });
  });

  test('renders an Edit button for each objective', () => {
    renderPage();
    const editButtons = screen.getAllByTitle(i18n.t('projects.objectives.edit'));
    expect(editButtons).toHaveLength(2);
  });

  test('clicking Edit button opens modal with the correct objective', () => {
    renderPage();
    const editButtons = screen.getAllByTitle(i18n.t('projects.objectives.edit'));
    // Click the first edit button (Objective 1)
    fireEvent.click(editButtons[0]);
    const modal = screen.getByTestId('objective-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute('data-objective-id', '1');
  });

  test('clicking Edit button does not toggle the accordion expand', () => {
    renderPage();
    // The tasks panel should not be visible before clicking
    expect(screen.queryByTestId('tasks-panel')).not.toBeInTheDocument();
    // Click edit button (has stopPropagation)
    const editButtons = screen.getAllByTitle(i18n.t('projects.objectives.edit'));
    fireEvent.click(editButtons[0]);
    // Tasks panel should still NOT be visible (accordion not expanded)
    expect(screen.queryByTestId('tasks-panel')).not.toBeInTheDocument();
    // The modal should be open though
    expect(screen.getByTestId('objective-modal')).toBeInTheDocument();
  });
});
