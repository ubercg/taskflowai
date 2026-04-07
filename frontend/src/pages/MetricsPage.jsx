import React from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { getProject } from '../services/api';
import MetricsDashboard from '../features/analytics/MetricsDashboard';

const MetricsPage = () => {
  const { id } = useParams();
  
  const { data: project } = useSWR(
    `/api/v1/projects/${id}`,
    () => getProject(id)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto', backgroundColor: '#f8fafc' }}>
      {/* Header idéntico al de BoardPage para consistencia visual */}
      <div style={{ padding: '24px 24px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', paddingBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {project?.name || 'Cargando...'}
          </h1>
          
          {/* View Toggle */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <Link
              to={`/projects/${id}/board`}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                color: '#64748b',
                fontWeight: 500,
                fontSize: '13px',
                textDecoration: 'none',
                transition: 'all 0.2s'
              }}
            >
              Kanban
            </Link>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                color: '#0f172a',
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'default'
              }}
            >
              Métricas
            </span>
          </div>
        </div>

        <button style={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          Exportar PDF
        </button>
      </div>

      {/* Contenido del Dashboard */}
      <div style={{ flex: 1 }}>
        <MetricsDashboard projectId={id} />
      </div>
    </div>
  );
};

export default MetricsPage;
