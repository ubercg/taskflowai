import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ObjectiveFormModal from '../ObjectiveFormModal';
import i18n from '../../../i18n';

vi.mock('../../../services/api/client', () => ({
  default: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import api from '../../../services/api/client';

const mockObjective = {
  id: 1,
  title: 'T',
  description: 'D',
  progress: 50,
  due_date: '2026-12-31T00:00:00Z',
  project_id: 1,
};

describe('ObjectiveFormModal — edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders title field with pre-filled value', () => {
    render(
      <ObjectiveFormModal
        projectId={1}
        objective={mockObjective}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByDisplayValue('T')).toBeInTheDocument();
  });

  test('renders textarea for description with pre-filled value', () => {
    render(
      <ObjectiveFormModal
        projectId={1}
        objective={mockObjective}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByDisplayValue('D')).toBeInTheDocument();
  });

  test('shows derived progress read-only with percentage', () => {
    render(
      <ObjectiveFormModal
        projectId={1}
        objective={mockObjective}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  test('does NOT render a range input (slider)', () => {
    render(
      <ObjectiveFormModal
        projectId={1}
        objective={mockObjective}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    const rangeInput = document.querySelector('input[type="range"]');
    expect(rangeInput).not.toBeInTheDocument();
  });

  test('submit in edit mode calls api.patch without progress key', async () => {
    api.patch.mockResolvedValueOnce({ data: {} });
    render(
      <ObjectiveFormModal
        projectId={1}
        objective={mockObjective}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fireEvent.click(screen.getByText(i18n.t('objectives.form.save')));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const callArgs = api.patch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/v1/objectives/1');
    expect(callArgs[1]).not.toHaveProperty('progress');
  });
});

describe('ObjectiveFormModal — create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('does NOT render progress display in create mode', () => {
    render(
      <ObjectiveFormModal
        projectId={1}
        objective={null}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    const rangeInput = document.querySelector('input[type="range"]');
    expect(rangeInput).not.toBeInTheDocument();
  });

  test('submit in create mode calls api.post', async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    render(
      <ObjectiveFormModal
        projectId={1}
        objective={null}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(i18n.t('objectives.form.title.placeholder')), {
      target: { value: 'New Objective' },
    });
    const dateInput = document.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByText(i18n.t('objectives.form.create')));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
  });
});
