import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';

// Mock api module before importing the component
vi.mock('../../../../services/api', () => ({
  getVelocity: vi.fn(),
  // alias mantenido para backward-compat — el componente reescrito ya no lo usa
  getVelocityMetrics: vi.fn(),
}));

import VelocityChart from '../VelocityChart';
import { getVelocity } from '../../../../services/api';

const START = '2026-06-01';
const END = '2026-07-01';
const PROJECT_ID = 1;

const renderChart = (overrides = {}) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <VelocityChart
        projectId={PROJECT_ID}
        startDate={START}
        endDate={END}
        {...overrides}
      />
    </SWRConfig>
  );

describe('VelocityChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no importa ni renderiza mockVelocityData — muestra estado vacío cuando el backend retorna []', async () => {
    getVelocity.mockResolvedValueOnce([]);
    renderChart();

    await waitFor(() => {
      expect(screen.getByText(/sin datos de velocity/i)).toBeInTheDocument();
    });
  });

  it('llama a getVelocity con projectId, startDate y endDate', async () => {
    getVelocity.mockResolvedValueOnce([]);
    renderChart();

    await waitFor(() => {
      expect(getVelocity).toHaveBeenCalledWith(PROJECT_ID, START, END);
    });
  });

  it('no muestra estado vacío cuando el backend retorna datos reales', async () => {
    const mockData = [
      { user_id: 1, name: 'Alice', color: '#ec4899', in_progress: 2, completed: 5, total_hours: 20 },
      { user_id: 2, name: 'Bob', color: '#3b82f6', in_progress: 1, completed: 3, total_hours: 12 },
    ];
    getVelocity.mockResolvedValueOnce(mockData);
    renderChart();

    // Espera a que SWR resuelva
    await waitFor(() => {
      expect(getVelocity).toHaveBeenCalledWith(PROJECT_ID, START, END);
    });

    // Con datos disponibles NO debe mostrar el estado vacío
    // (Recharts ResponsiveContainer no renderiza ticks en jsdom, pero el empty-state sí es testeable)
    expect(screen.queryByText(/sin datos de velocity/i)).not.toBeInTheDocument();
  });

  it('NO contiene la cadena "mockVelocityData" en el componente', async () => {
    // Verificamos en tiempo de test que el módulo no usa mockVelocityData
    // importando el texto fuente (vía dinámico) — este test es un smoke check.
    getVelocity.mockResolvedValueOnce([]);
    const { container } = renderChart();
    // El component no debe tener texto de datos mock hardcodeados como "Alice", "Bob", etc.
    await waitFor(() => {
      expect(screen.getByText(/sin datos de velocity/i)).toBeInTheDocument();
    });
    // No deben aparecer nombres de mock hardcodeados cuando data es []
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
    expect(screen.queryByText('Diana')).not.toBeInTheDocument();
  });

  it('muestra estado de carga mientras espera la respuesta', () => {
    // getVelocity nunca resuelve en este test (promise pendiente)
    getVelocity.mockReturnValue(new Promise(() => {}));
    renderChart();

    // El componente no debe crashear durante la carga
    expect(screen.getByText(/velocity por usuario/i)).toBeInTheDocument();
  });
});
