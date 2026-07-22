import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import {
  getFlowMetrics,
  getTasks,
  getVelocity,
  getAgingMetrics,
  getBurndown,
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
 * Bloque de métricas que se adjunta al PDF del calendario, después de la grilla.
 *
 * Se monta solo durante la exportación y queda fuera de pantalla (con ancho fijo)
 * para que los charts de Recharts midan y pinten. Replica las mismas SWR keys que
 * usan los charts/KPIs: SWR deduplica las requests y comparte el caché, así sabemos
 * cuándo los datos reales están listos (`onReady`) antes de disparar window.print().
 *
 * Las keys de los hooks de readiness deben coincidir EXACTAMENTE con las keys que
 * usan los charts hijos para que SWR los deduplique en lugar de emitir un segundo fetch:
 *   - BurndownChart:  ['/api/v1/metrics/burndown',  projectId, startDate, endDate]
 *   - VelocityChart:  ['/api/v1/metrics/velocity',  projectId, startDate, endDate]
 *   - AgingChart:     ['/api/v1/metrics/aging',     projectId]  (solo si isCurrentMonth)
 *
 * @param {{ projectId: number, startDate: string, endDate: string, isCurrentMonth: boolean, onReady: () => void }} props
 */
function CalendarPdfReport({ projectId, startDate, endDate, isCurrentMonth, onReady }) {
  const { t } = useTranslation();
  // ── KPI cards ────────────────────────────────────────────────────────────────
  // Flow: rango medio-abierto del mes seleccionado (misma shape que MetricsDashboard)
  const flow = useSWR(
    projectId ? ['/api/v1/metrics/flow', projectId, startDate, endDate] : null,
    () => getFlowMetrics(projectId, startDate, endDate),
    { shouldRetryOnError: false }
  );

  // Tasks: solo necesario para el WIP (punto en el tiempo; relevante solo para el mes actual)
  const tasks = useSWR(
    projectId && isCurrentMonth ? `/api/v1/tasks?project_id=${projectId}` : null,
    () => getTasks({ project_id: projectId }),
    { shouldRetryOnError: false }
  );

  // OKR progress chart
  const okr = useSWR(
    projectId ? `/api/v1/objectives?project_id=${projectId}` : null,
    () => getObjectives(projectId),
    { shouldRetryOnError: false }
  );

  // ── Readiness gate — mirror chart SWR keys exactly ───────────────────────────
  // Velocity: misma key que VelocityChart → SWR deduplica, no hay segundo fetch
  const velocity = useSWR(
    projectId ? ['/api/v1/metrics/velocity', projectId, startDate, endDate] : null,
    () => getVelocity(projectId, startDate, endDate),
    { shouldRetryOnError: false }
  );

  // Burndown: misma key que BurndownChart → SWR deduplica
  const burndown = useSWR(
    projectId ? ['/api/v1/metrics/burndown', projectId, startDate, endDate] : null,
    () => getBurndown(projectId, startDate, endDate),
    { shouldRetryOnError: false }
  );

  // Aging: misma key que AgingChart (solo cuando es mes actual) → SWR deduplica
  const aging = useSWR(
    projectId && isCurrentMonth ? ['/api/v1/metrics/aging', projectId] : null,
    () => getAgingMetrics(projectId),
    { shouldRetryOnError: false }
  );

  // Una key está "asentada" cuando ya hay data o error (con shouldRetryOnError: false
  // el error es terminal). Tasks y aging son condicionales al mes actual; si la key
  // es null, SWR nunca dispara el fetch → se considera asentada de inmediato (data y
  // error son ambos undefined, pero la condición clave es que no hay fetching pendiente).
  const tasksSettled = !isCurrentMonth || tasks.data !== undefined || tasks.error !== undefined;
  const agingSettled = !isCurrentMonth || aging.data !== undefined || aging.error !== undefined;

  const settled =
    (flow.data !== undefined || flow.error !== undefined) &&
    tasksSettled &&
    (velocity.data !== undefined || velocity.error !== undefined) &&
    (burndown.data !== undefined || burndown.error !== undefined) &&
    agingSettled &&
    (okr.data !== undefined || okr.error !== undefined);

  const firedRef = useRef(false);
  useEffect(() => {
    if (settled && !firedRef.current) {
      firedRef.current = true;
      onReady && onReady();
    }
  }, [settled, onReady]);

  // ── KPI values ───────────────────────────────────────────────────────────────
  const leadTime = flow.data?.lead_time_avg_h || 0;
  const cycleTime = flow.data?.cycle_time_avg_h || 0;
  // /flow con rango devuelve "throughput"; sin rango la matview devuelve "throughput_week"
  const throughput = flow.data?.throughput ?? flow.data?.throughput_week ?? 0;
  const wipTasks = (isCurrentMonth && tasks.data)
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
        {t('calendar.pdf.metricsTitle')}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KPICard title={t('metrics.kpi.leadTime.title')} value={`${leadTime.toFixed(2)}h`} subtitle={t('metrics.kpi.leadTime.subtitle')} borderColor="#3b82f6" />
        <KPICard title={t('metrics.kpi.cycleTime.title')} value={`${cycleTime.toFixed(2)}h`} subtitle={t('metrics.kpi.cycleTime.subtitle')} borderColor="#8b5cf6" />
        <KPICard title={t('metrics.kpi.throughput.title')} value={`${throughput}`} subtitle={t('metrics.kpi.throughput.subtitle')} borderColor="#10b981" />
        <KPICard title={t('metrics.kpi.wip.title')} value={`${wipTasks}`} subtitle={isCurrentMonth ? t('metrics.kpi.wip.subtitleActive') : t('metrics.kpi.wip.subtitleInactive')} borderColor={wipTasks >= 3 ? '#ef4444' : '#eab308'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        <BurndownChart projectId={projectId} startDate={startDate} endDate={endDate} animate={false} forceTheme="light" />
        <VelocityChart projectId={projectId} startDate={startDate} endDate={endDate} animate={false} forceTheme="light" />
        <AgingChart projectId={projectId} isCurrentMonth={isCurrentMonth} animate={false} forceTheme="light" />
        <OkrProgressChart projectId={projectId} animate={false} forceTheme="light" />
      </div>
    </div>
  );
}

export default CalendarPdfReport;
