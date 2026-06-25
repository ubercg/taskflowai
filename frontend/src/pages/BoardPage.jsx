import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { getProject } from '../services/api';
import KanbanBoard from '../features/execution/KanbanBoard';
import TaskListView from '../features/execution/TaskListView';
import TaskModal from '../features/execution/TaskModal';
import DailySummary from '../features/analytics/DailySummary';
import usePermissions from '../hooks/usePermissions';
import Can from '../components/shared/Can';
import TaskFormModal from '../features/execution/TaskFormModal';
import { useKanbanStore } from '../store/kanbanStore';
import CalendarView from '../features/calendar/CalendarView';
import { Button } from '../components/ui';
import { cn } from '../lib/cn';

const ViewTab = ({ active, children, ...props }) => (
  <button
    type="button"
    className={cn(
      'rounded-md px-3 py-1.5 text-[13px] font-medium transition-all',
      active ? 'bg-surface text-fg shadow-soft' : 'text-muted hover:text-fg',
    )}
    {...props}
  >
    {children}
  </button>
);

const BoardPage = () => {
  const { id } = useParams();
  const [viewMode, setViewMode] = useState('list'); // 'kanban' | 'list' | 'calendar'
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormStatus, setTaskFormStatus] = useState('backlog');
  const [showSummary, setShowSummary] = useState(false);
  const { canCreateTask, canViewMetrics } = usePermissions();

  const { data: project, isLoading } = useSWR(`/api/v1/projects/${id}`, () => getProject(id));

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            {isLoading ? 'Cargando...' : project?.name}
          </h1>

          <Can permission={canViewMetrics}>
            <button
              onClick={() => setShowSummary(!showSummary)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium transition-colors',
                showSummary ? 'bg-raised text-fg' : 'bg-surface text-muted hover:text-fg',
              )}
            >
              🤖 {showSummary ? 'Ocultar resumen' : 'Resumen del día'}
            </button>
          </Can>

          {/* Switcher de vistas */}
          <div className="flex rounded-lg bg-raised p-1">
            <ViewTab active={viewMode === 'list'} onClick={() => setViewMode('list')}>Lista</ViewTab>
            <ViewTab active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')}>Kanban</ViewTab>
            <ViewTab active={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}>Calendario</ViewTab>
            <Link
              to={`/projects/${id}/metrics`}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
            >
              Métricas
            </Link>
          </div>
        </div>

        <Can permission={canCreateTask}>
          <Button onClick={() => { setTaskFormStatus('backlog'); setShowTaskForm(true); }} size="sm">
            + Nueva Tarea
          </Button>
        </Can>
      </div>

      {/* Daily Summary */}
      {showSummary && (
        <div className="pb-4">
          <DailySummary projectId={id} />
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'kanban' ? (
          <KanbanBoard
            projectId={id}
            onTaskClick={(taskId) => setSelectedTaskId(taskId)}
            onAddTask={(status) => { setTaskFormStatus(status); setShowTaskForm(true); }}
          />
        ) : viewMode === 'list' ? (
          <div className="h-full overflow-y-auto pr-1">
            <TaskListView projectId={id} onOpen={(taskId) => setSelectedTaskId(taskId)} />
          </div>
        ) : (
          <CalendarView projectId={id} onTaskClick={(taskId) => setSelectedTaskId(taskId)} />
        )}
      </div>

      {/* Modal de detalle de tarea */}
      {selectedTaskId && <TaskModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}

      {/* Modal de creación rápida */}
      {showTaskForm && (
        <TaskFormModal
          projectId={id}
          defaultStatus={taskFormStatus}
          onClose={() => setShowTaskForm(false)}
          onCreated={(task) => {
            setShowTaskForm(false);
            const { columns, setColumns } = useKanbanStore.getState();
            if (columns[task.status]) {
              setColumns({ ...columns, [task.status]: [...columns[task.status], task] });
            }
          }}
        />
      )}
    </div>
  );
};

export default BoardPage;
