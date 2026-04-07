import React from 'react';
import useSWR from 'swr';
import { getFlowMetrics, getTasks } from '../../services/api';
import BurndownChart from './charts/BurndownChart';
import VelocityChart from './charts/VelocityChart';
import AgingChart from './charts/AgingChart';
import OkrProgressChart from './charts/OkrProgressChart';

import DailySummary from './DailySummary';

const KPICard = ({ title, value, subtitle, borderColor, alertValue }) => (
  <div style={{
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    borderLeft: `4px solid ${borderColor}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }}>
    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {title}
    </span>
    <div style={{ fontSize: '32px', fontWeight: 700, color: '#0f172a' }}>
      {value}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{subtitle}</span>
      {alertValue !== undefined && (
        <div style={{ flex: 1, height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${Math.min(alertValue * 33.33, 100)}%`, 
            backgroundColor: alertValue >= 3 ? '#ef4444' : '#22c55e',
            transition: 'width 0.5s ease'
          }} />
        </div>
      )}
    </div>
  </div>
);

const MetricsDashboard = ({ projectId }) => {
  // SWR calls en paralelo
  const { data: flowMetrics, isLoading: loadingFlow } = useSWR(
    projectId ? `/api/v1/metrics/flow?project_id=${projectId}` : null, 
    () => getFlowMetrics(projectId), 
    { shouldRetryOnError: false }
  );
  
  const { data: tasks, isLoading: loadingTasks } = useSWR(
    projectId ? `/api/v1/tasks?project_id=${projectId}` : null, 
    () => getTasks({ project_id: projectId }), 
    { shouldRetryOnError: false }
  );

  const isLoading = loadingFlow || loadingTasks;

  // Calculos / Fallbacks seguros
  const leadTime = flowMetrics?.lead_time_avg_h || 0;
  const cycleTime = flowMetrics?.cycle_time_avg_h || 0;
  const throughput = flowMetrics?.throughput_week || 0;
  
  // WIP Actual: Calculado directo desde las tareas cargadas
  const wipTasks = tasks ? tasks.filter(t => t.status === 'in_progress').length : 0;

  if (isLoading) return <div style={{ padding: '24px', color: '#64748b' }}>Analizando métricas de flujo...</div>;

  return (
    <div style={{ backgroundColor: '#f8fafc', padding: '24px', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Daily Summary AI Widget */}
      <DailySummary projectId={projectId} />

      {/* 4 KPI Cards (2x2 grid en mobile, fila completa en desktop) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
        <KPICard 
          title="Lead Time" 
          value={`${leadTime}h`} 
          subtitle="Promedio desde creación" 
          borderColor="#3b82f6" 
        />
        <KPICard 
          title="Cycle Time" 
          value={`${cycleTime}h`} 
          subtitle="Promedio desde inicio" 
          borderColor="#8b5cf6" 
        />
        <KPICard 
          title="Throughput" 
          value={`${throughput}`} 
          subtitle="Tareas completadas / sem" 
          borderColor="#10b981" 
        />
        <KPICard 
          title="WIP Actual" 
          value={`${wipTasks}`} 
          subtitle="Tareas en progreso" 
          borderColor={wipTasks >= 3 ? '#ef4444' : '#eab308'}
          alertValue={wipTasks}
        />
      </div>

      {/* 4 Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', paddingBottom: '32px' }}>
        <BurndownChart projectId={projectId} />
        <VelocityChart projectId={projectId} />
        <AgingChart projectId={projectId} />
        <OkrProgressChart projectId={projectId} />
      </div>
    </div>
  );
};

export default MetricsDashboard;
