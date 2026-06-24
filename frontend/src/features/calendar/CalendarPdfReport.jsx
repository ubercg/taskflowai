import React, { useEffect, useRef } from 'react';
import useSWR from 'swr';
import {
  getFlowMetrics,
  getTasks,
  getVelocityMetrics,
  getAgingMetrics,
  getObjectives,
} from '../../services/api';
import BurndownChart from '../analytics/charts/BurndownChart';
import VelocityChart from '../analytics/charts/VelocityChart';
import AgingChart from '../analytics/charts/AgingChart';
import OkrProgressChart from '../analytics/charts/OkrProgressChart';

const KPICard = ({ title, value, subtitle, borderColor }) => (
  <div
    style={{
      backgroundColor: '#ffffff',
      padding: '20px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      borderLeft: `4px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}
  >
    <span
      style={{
        fontSize: '12px',
        color: '#64748b',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {title}
    </span>
    <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{subtitle}</span>
  </div>
);

/**
 * Bloque de metricas que se adjunta al PDF del calendario, despues de la grilla.
 *
 * Se monta solo durante la exportacion y queda fuera de pantalla (con ancho fijo)
 * para que los charts de Recharts midan y pinten. Replica las mismas SWR keys que
 * usan los charts/KPIs: SWR dedupea las requests y comparte el cache, asi sabemos
 * cuando los datos reales estan listos (`onReady`) antes de disparar window.print().
 */
function CalendarPdfReport({ projectId, onReady }) {
  const flow = useSWR(
    projectId ? `/api/v1/metrics/flow?project_id=${projectId}` : null,
    () => getFlowMetrics(projectId),
    { shouldRetryOnError: false }
  );
  const tasks = useSWR(
    projectId ? `/api/v1/tasks?project_id=${projectId}` : null,
    () => getTasks({ project_id: projectId }),
    { shouldRetryOnError: false }
  );
  const velocity = useSWR('/api/v1/metrics/velocity', getVelocityMetrics, {
    shouldRetryOnError: false,
  });
  const aging = useSWR('/api/v1/metrics/aging', getAgingMetrics, {
    shouldRetryOnError: false,
  });
  const okr = useSWR(
    projectId ? `/api/v1/objectives?project_id=${projectId}` : null,
    () => getObjectives(projectId),
    { shouldRetryOnError: false }
  );

  // Una key esta "asentada" cuando ya hay data o error (con shouldRetryOnError:false
  // el error es terminal). Burndown usa mock local, no necesita espera.
  const settled = [flow, tasks, velocity, aging, okr].every(
    (h) => h.data !== undefined || h.error !== undefined
  );

  const firedRef = useRef(false);
  useEffect(() => {
    if (settled && !firedRef.current) {
      firedRef.current = true;
      onReady && onReady();
    }
  }, [settled, onReady]);

  const leadTime = flow.data?.lead_time_avg_h || 0;
  const cycleTime = flow.data?.cycle_time_avg_h || 0;
  const throughput = flow.data?.throughput_week || 0;
  const wipTasks = tasks.data
    ? tasks.data.filter((t) => t.status === 'in_progress').length
    : 0;

  return (
    <div className="calendar-pdf-report">
      <div
        style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: '16px',
          paddingBottom: '8px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        Métricas del Proyecto
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KPICard title="Lead Time" value={`${leadTime}h`} subtitle="Promedio desde creación" borderColor="#3b82f6" />
        <KPICard title="Cycle Time" value={`${cycleTime}h`} subtitle="Promedio desde inicio" borderColor="#8b5cf6" />
        <KPICard title="Throughput" value={`${throughput}`} subtitle="Tareas completadas / sem" borderColor="#10b981" />
        <KPICard title="WIP Actual" value={`${wipTasks}`} subtitle="Tareas en progreso" borderColor={wipTasks >= 3 ? '#ef4444' : '#eab308'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        <BurndownChart projectId={projectId} />
        <VelocityChart projectId={projectId} />
        <AgingChart projectId={projectId} />
        <OkrProgressChart projectId={projectId} />
      </div>
    </div>
  );
}

export default CalendarPdfReport;
