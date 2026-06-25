import { useState } from 'react';
import useSWR from 'swr';
import { format, startOfMonth, addMonths, isSameMonth } from 'date-fns';
import { getFlowMetrics, getTasks } from '../../services/api';
import BurndownChart from './charts/BurndownChart';
import VelocityChart from './charts/VelocityChart';
import AgingChart from './charts/AgingChart';
import OkrProgressChart from './charts/OkrProgressChart';
import MonthSelector from './MonthSelector';
import DailySummary from './DailySummary';

const KPICard = ({ title, value, subtitle, borderColor, alertValue }) => (
  <div
    className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-6 shadow-soft"
    style={{ borderLeft: `4px solid ${borderColor}` }}
  >
    <span className="text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</span>
    <div className="text-[32px] font-bold text-fg">{value}</div>
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-medium text-muted">{subtitle}</span>
      {alertValue !== undefined && (
        <div className="h-1 flex-1 overflow-hidden rounded-sm bg-border">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(alertValue * 33.33, 100)}%`,
              backgroundColor: alertValue >= 3 ? '#ef4444' : '#22c55e',
            }}
          />
        </div>
      )}
    </div>
  </div>
);

const MetricsDashboard = ({ projectId }) => {
  const [month, setMonth] = useState(new Date());

  const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
  const endDate = format(startOfMonth(addMonths(month, 1)), 'yyyy-MM-dd');
  const isCurrentMonth = isSameMonth(month, new Date());

  const { data: flowMetrics, isLoading: loadingFlow } = useSWR(
    projectId ? ['/api/v1/metrics/flow', projectId, startDate, endDate] : null,
    () => getFlowMetrics(projectId, startDate, endDate),
    { shouldRetryOnError: false },
  );

  const { data: tasks, isLoading: loadingTasks } = useSWR(
    projectId && isCurrentMonth ? `/api/v1/tasks?project_id=${projectId}` : null,
    () => getTasks({ project_id: projectId }),
    { shouldRetryOnError: false },
  );

  const isLoading = loadingFlow || (isCurrentMonth && loadingTasks);

  const leadTime = flowMetrics?.lead_time_avg_h || 0;
  const cycleTime = flowMetrics?.cycle_time_avg_h || 0;
  const throughput = flowMetrics?.throughput ?? flowMetrics?.throughput_week ?? 0;
  const wipTasks = isCurrentMonth && tasks ? tasks.filter((t) => t.status === 'in_progress').length : null;

  if (isLoading) return <div className="p-6 text-muted">Analizando métricas de flujo...</div>;

  return (
    <div className="flex min-h-full flex-col gap-6 bg-canvas p-6">
      <DailySummary projectId={projectId} />

      <div className="flex items-center justify-end">
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
        <KPICard title="Lead Time" value={`${leadTime.toFixed(2)}h`} subtitle="Promedio desde creación" borderColor="#3b82f6" />
        <KPICard title="Cycle Time" value={`${cycleTime.toFixed(2)}h`} subtitle="Promedio desde inicio" borderColor="#8b5cf6" />
        <KPICard title="Throughput" value={`${throughput}`} subtitle="Tareas completadas / sem" borderColor="#10b981" />
        <KPICard
          title="WIP Actual"
          value={wipTasks !== null ? `${wipTasks}` : '—'}
          subtitle={wipTasks !== null ? 'Tareas en progreso' : 'Solo mes actual'}
          borderColor={wipTasks !== null && wipTasks >= 3 ? '#ef4444' : '#eab308'}
          alertValue={wipTasks !== null ? wipTasks : undefined}
        />
      </div>

      {/* 4 Charts */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(450px,1fr))] gap-6 pb-8">
        <BurndownChart projectId={projectId} startDate={startDate} endDate={endDate} />
        <VelocityChart projectId={projectId} startDate={startDate} endDate={endDate} />
        <AgingChart projectId={projectId} isCurrentMonth={isCurrentMonth} />
        <OkrProgressChart projectId={projectId} />
      </div>
    </div>
  );
};

export default MetricsDashboard;
