import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';

// Mock api module before importing the component
vi.mock('../../../../services/api', () => ({
  getBurndown: vi.fn(),
}));

import BurndownChart from '../BurndownChart';
import { getBurndown } from '../../../../services/api';

const START = '2026-06-01';
const END = '2026-07-01';
const PROJECT_ID = 1;

const renderChart = (overrides = {}) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <BurndownChart
        projectId={PROJECT_ID}
        startDate={START}
        endDate={END}
        {...overrides}
      />
    </SWRConfig>
  );

describe('BurndownChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('llama a getBurndown con projectId, startDate y endDate', async () => {
    getBurndown.mockResolvedValueOnce([]);
    renderChart();

    await waitFor(() => {
      expect(getBurndown).toHaveBeenCalledWith(PROJECT_ID, START, END);
    });
  });

  it('muestra estado vacío cuando el backend retorna [] (serie vacía)', async () => {
    getBurndown.mockResolvedValueOnce([]);
    renderChart();

    await waitFor(() => {
      expect(screen.getByText(/sin tareas con fecha de entrega/i)).toBeInTheDocument();
    });
  });

  it('muestra estado vacío cuando todos los puntos son cero', async () => {
    const serieVacia = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      ideal: 0,
      real: 0,
    }));
    getBurndown.mockResolvedValueOnce(serieVacia);
    renderChart();

    await waitFor(() => {
      expect(screen.getByText(/sin tareas con fecha de entrega/i)).toBeInTheDocument();
    });
  });

  it('no muestra estado vacío cuando el backend retorna datos reales', async () => {
    const mockData = [
      { date: '2026-06-01', ideal: 10, real: 10 },
      { date: '2026-06-15', ideal: 5, real: 7 },
      { date: '2026-06-30', ideal: 0, real: 3 },
    ];
    getBurndown.mockResolvedValueOnce(mockData);
    renderChart();

    await waitFor(() => {
      expect(getBurndown).toHaveBeenCalledWith(PROJECT_ID, START, END);
    });

    // Con datos disponibles NO debe mostrar el estado vacío
    expect(screen.queryByText(/sin tareas con fecha de entrega/i)).not.toBeInTheDocument();
  });

  it('renderiza el título del chart', () => {
    getBurndown.mockReturnValue(new Promise(() => {}));
    renderChart();
    expect(screen.getByText(/burndown/i)).toBeInTheDocument();
  });

  it('no usa mockData hardcodeado — el chart muestra estado vacío sin projectId', async () => {
    getBurndown.mockResolvedValueOnce([]);
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <BurndownChart projectId={null} startDate={START} endDate={END} />
      </SWRConfig>
    );

    // Sin projectId, SWR no dispara; el componente no debe mostrar datos de mock
    // (puede mostrar empty state o nada, pero no el chart con datos hardcodeados)
    expect(screen.queryByText('01/04')).not.toBeInTheDocument();
    expect(screen.queryByText('18/04')).not.toBeInTheDocument();
  });
});
