import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const objectiveParam = searchParams.get('objective');
  const [viewMode, setViewMode] = useState('list'); // 'kanban' | 'list' | 'calendar'
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormStatus, setTaskFormStatus] = useState('backlog');
  const [showSummary, setShowSummary] = useState(false);
  const { canCreateTask, canViewMetrics } = usePermissions();

  const { data: project, isLoading } = useSWR(`/api/v1/projects/${id}`, () => getProject(id));

  const clearObjectiveFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('objective');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            {isLoading ? t('execution.board.loadingTitle') : project?.name}
          </h1>

          <Can permission={canViewMetrics}>
            <button
              onClick={() => setShowSummary(!showSummary)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium transition-colors',
                showSummary ? 'bg-raised text-fg' : 'bg-surface text-muted hover:text-fg',
              )}
            >
              <span aria-hidden="true">🤖</span> {showSummary ? t('execution.board.hideSummary') : t('execution.board.showSummary')}
            </button>
          </Can>

          {/* Switcher de vistas */}
          <div className="flex rounded-lg bg-raised p-1">
            <ViewTab active={viewMode === 'list'} onClick={() => setViewMode('list')}>{t('execution.board.views.list')}</ViewTab>
            <ViewTab active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')}>{t('execution.board.views.kanban')}</ViewTab>
            <ViewTab active={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}>{t('execution.board.views.calendar')}</ViewTab>
            <Link
              to={`/projects/${id}/metrics`}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
            >
              {t('execution.board.metricsLink')}
            </Link>
          </div>
        </div>

        <Can permission={canCreateTask}>
          <Button onClick={() => { setTaskFormStatus('backlog'); setShowTaskForm(true); }} size="sm">
            {t('execution.board.newTask')}
          </Button>
        </Can>
      </div>

      {objectiveParam && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-accent-soft/40 px-3 py-2 text-[13px] text-fg">
          <span>{t('execution.board.objectiveFilter', { id: objectiveParam })}</span>
          <button
            type="button"
            onClick={clearObjectiveFilter}
            className="font-medium text-accent hover:text-accent-hover"
          >
            {t('execution.board.clearObjectiveFilter')}
          </button>
        </div>
      )}

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
            objectiveId={objectiveParam}
            onTaskClick={(taskId) => setSelectedTaskId(taskId)}
            onAddTask={(status) => { setTaskFormStatus(status); setShowTaskForm(true); }}
          />
        ) : viewMode === 'list' ? (
          <div className="h-full overflow-y-auto pr-1">
            <TaskListView
              projectId={id}
              initialObjective={objectiveParam}
              onOpen={(taskId) => setSelectedTaskId(taskId)}
            />
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
          defaultObjectiveId={objectiveParam ? Number(objectiveParam) : undefined}
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
