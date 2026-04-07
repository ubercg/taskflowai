import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { getProject } from '../services/api';
import KanbanBoard from '../features/execution/KanbanBoard';
import TaskListView from '../features/execution/TaskListView';
import TaskModal from '../features/execution/TaskModal';

import DailySummary from '../features/analytics/DailySummary';
import usePermissions from '../hooks/usePermissions';
import Can from '../components/shared/Can';
import TaskFormModal from '../features/execution/TaskFormModal'; // AGREGADO
import { useKanbanStore } from '../store/kanbanStore'; // AGREGADO

const BoardPage = () => {
  const { id } = useParams();
  // Vista inicial: lista (mejor lectura de detalle; rol viewer y el resto entran igual aquí).
  const [viewMode, setViewMode] = useState('list'); // 'kanban' | 'list'
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false); // AGREGADO
  const [taskFormStatus, setTaskFormStatus] = useState('backlog'); // AGREGADO
  const [showSummary, setShowSummary] = useState(false);
  const { canCreateTask, canViewMetrics } = usePermissions();

  const { data: project, error, isLoading } = useSWR(
    `/api/v1/projects/${id}`,
    () => getProject(id)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {isLoading ? 'Cargando...' : project?.name}
          </h1>

          <Can permission={canViewMetrics}>
            <button
              onClick={() => setShowSummary(!showSummary)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '8px', fontSize: '13px',
                border: '1px solid #e2e8f0', background: showSummary ? '#f1f5f9' : 'white',
                cursor: 'pointer', fontWeight: 500
              }}
            >
              🤖 {showSummary ? 'Ocultar resumen' : 'Resumen del día'}
            </button>
          </Can>
          
          {/* Vista: Lista primero (predeterminada), Kanban como alternativa */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: viewMode === 'list' ? '#ffffff' : 'transparent',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: viewMode === 'list' ? '#0f172a' : '#64748b',
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: viewMode === 'kanban' ? '#ffffff' : 'transparent',
                boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: viewMode === 'kanban' ? '#0f172a' : '#64748b',
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Kanban
            </button>
            <Link
              to={`/projects/${id}/metrics`}
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
              Métricas
            </Link>
          </div>
        </div>

        <Can permission={canCreateTask}>
          <button 
            onClick={() => { setTaskFormStatus('backlog'); setShowTaskForm(true); }} // MODIFICADO
            style={{
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
            }}
          >
            + Nueva Tarea
          </button>
        </Can>
      </div>

      {/* Daily Summary Inject */}
      {showSummary && (
        <div style={{ padding: '0 0 16px 0' }}>
          <DailySummary projectId={id} />
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === 'kanban' ? (
          <KanbanBoard 
            projectId={id} 
            onTaskClick={(taskId) => setSelectedTaskId(taskId)} 
            onAddTask={(status) => { setTaskFormStatus(status); setShowTaskForm(true); }} // AGREGADO
          />
        ) : (
          <div style={{ height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
            <TaskListView projectId={id} onOpen={(taskId) => setSelectedTaskId(taskId)} />
          </div>
        )}
      </div>

      {/* Modal Slide-in para Detalles/Edición de Tarea */}
      {selectedTaskId && (
        <TaskModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}

      {/* Modal Rápido de Creación de Tarea (AGREGADO) */}
      {showTaskForm && (
        <TaskFormModal
          projectId={id}
          defaultStatus={taskFormStatus}
          onClose={() => setShowTaskForm(false)}
          onCreated={(task) => {
            setShowTaskForm(false);
            // Agregar al kanbanStore sin recargar
            const { columns, setColumns } = useKanbanStore.getState();
            // Aseguramos que status sea un array válido (en caso de fallos) y metemos la tarea al final
            if (columns[task.status]) {
              setColumns({ 
                ...columns, 
                [task.status]: [...columns[task.status], task] 
              });
            }
          }}
        />
      )}
    </div>
  );
};

export default BoardPage;
