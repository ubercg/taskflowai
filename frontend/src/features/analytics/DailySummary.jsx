import React, { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'react-router-dom';
import { getDailySummary } from '../../services/api';
import api from '../../services/api/client';
import TaskModal from './../execution/TaskModal'; // Reutilizamos el modal que armamos antes

const SkeletonSummary = () => (
  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ height: '20px', width: '40%', backgroundColor: '#e2e8f0', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
    <div style={{ height: '14px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
    <div style={{ height: '14px', width: '80%', backgroundColor: '#e2e8f0', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
  </div>
);

const DailySummary = ({ projectId }) => {
  const { id } = useParams();
  const activeProjectId = projectId || id;
  const [expandedSection, setExpandedSection] = useState(null); // 'blocked' | 'advanced' | 'risks'
  const [selectedTask, setSelectedTask] = useState(null);

  // Clave estable + fetcher con Axios (baseURL → backend :8000). Antes el 2º arg era solo opciones:
  // SWR usaba fetch() relativo al :3000 y la petición fallaba sin token.
  const { data, error, isLoading, mutate } = useSWR(
    activeProjectId ? ['daily-summary', activeProjectId] : null,
    () => getDailySummary(activeProjectId),
    { refreshInterval: 0 }
  );

  const handleRefresh = async () => {
    // Forzar refresh en el backend y luego revalidar SWR
    try {
      await api.get(`/api/v1/ai/daily-summary?project_id=${activeProjectId}&refresh=true`);
      mutate();
    } catch (e) {
      console.error(e);
      mutate();
    }
  };

  const toggleSection = (section) => {
    if (expandedSection === section) setExpandedSection(null);
    else setExpandedSection(section);
  };

  if (isLoading) {
    return (
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #6366f1', borderRadius: '8px', minHeight: '120px' }}>
        <SkeletonSummary />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #fca5a5', borderLeft: '4px solid #ef4444', borderRadius: '8px', padding: '16px' }}>
        <p style={{ margin: 0, color: '#991b1b', fontSize: '14px', fontWeight: 500 }}>No se pudo generar el resumen inteligente.</p>
        <button onClick={() => mutate()} style={{ marginTop: '8px', padding: '4px 8px', fontSize: '12px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '4px', cursor: 'pointer' }}>Reintentar</button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <div style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid #e2e8f0', 
        borderLeft: '4px solid #6366f1', 
        borderRadius: '8px', 
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>✨</span>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Resumen del Día</h3>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              {new Date(data.generated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
          <button 
            onClick={handleRefresh}
            style={{ background: 'none', border: '1px solid #e2e8f0', padding: '4px 8px', borderRadius: '4px', color: '#64748b', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ↻ Actualizar
          </button>
        </div>

        {/* NLP Summary */}
        <p style={{ 
          margin: '0 0 16px 0', 
          fontSize: '14px', 
          color: '#334155', 
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {data.stats?.total_moves === 0 ? "Sin actividad registrada en las últimas 24 horas" : data.summary_text}
        </p>

        {/* Categorias (Botones horizontales) */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          
          <button 
            onClick={() => toggleSection('blocked')}
            style={{ 
              flex: 1, 
              padding: '8px', 
              borderRadius: '6px', 
              border: expandedSection === 'blocked' ? '1px solid #fca5a5' : '1px solid transparent', 
              backgroundColor: '#fef2f2', 
              color: '#991b1b', 
              cursor: 'pointer', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 700 }}>{data.stats?.blocked_count || data.blocked?.length || 0}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>Bloqueadas</span>
          </button>

          <button 
            onClick={() => toggleSection('advanced')}
            style={{ 
              flex: 1, 
              padding: '8px', 
              borderRadius: '6px', 
              border: expandedSection === 'advanced' ? '1px solid #86efac' : '1px solid transparent', 
              backgroundColor: '#f0fdf4', 
              color: '#166534', 
              cursor: 'pointer', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 700 }}>{data.advanced?.length || 0}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>Avanzadas</span>
          </button>

          <button 
            onClick={() => toggleSection('risks')}
            style={{ 
              flex: 1, 
              padding: '8px', 
              borderRadius: '6px', 
              border: expandedSection === 'risks' ? '1px solid #fde047' : '1px solid transparent', 
              backgroundColor: '#fefce8', 
              color: '#854d0e', 
              cursor: 'pointer', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 700 }}>{data.stats?.at_risk_count || data.risks?.length || 0}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>En Riesgo</span>
          </button>
        </div>

        {/* Listado Expandido */}
        {expandedSection && (
          <div style={{ marginTop: '16px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
              Detalle de tareas
            </h4>
            
            {data[expandedSection].length === 0 ? (
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>No hay tareas en esta categoría.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data[expandedSection].map(task => (
                  <div 
                    key={task.task_id}
                    onClick={() => setSelectedTask(task.task_id)}
                    style={{ 
                      backgroundColor: '#ffffff', 
                      padding: '8px 12px', 
                      borderRadius: '4px', 
                      border: '1px solid #cbd5e1', 
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#94a3b8'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>{task.title}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {expandedSection === 'blocked' && `Tiempo en bloqueo: ${task.blocked_since}`}
                      {expandedSection === 'advanced' && `Movida: ${task.from_status ?? task.from} → ${task.to_status ?? task.to}`}
                      {expandedSection === 'risks' && task.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Renderizar Modal si hay click */}
      {selectedTask && (
        <TaskModal taskId={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </>
  );
};

export default DailySummary;
