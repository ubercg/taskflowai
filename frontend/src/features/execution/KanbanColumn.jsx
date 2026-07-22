import { useTranslation } from 'react-i18next';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from '../../components/kanban/TaskCard';
import usePermissions from '../../hooks/usePermissions';
import Can from '../../components/shared/Can';
import { cn } from '../../lib/cn';

// Color de acento por columna (se aplica inline en el subrayado del header).
const COL_COLORS = {
  backlog: '#94a3b8',
  todo: '#60a5fa',
  in_progress: '#818cf8',
  review: '#fb923c',
  blocked: '#f87171',
  done: '#4ade80',
};

const KanbanColumn = ({ columnId, title, tasks = [], wipCount, wipLimit, onTaskClick, onAddTask, bottleneck }) => {
  const { t } = useTranslation();
  const { canMoveTask, canCreateTask } = usePermissions();
  const isWipExceeded = columnId === 'in_progress' && wipCount >= wipLimit;
  const isBottleneck = bottleneck?.is_bottleneck;

  return (
    <div
      className={cn(
        'flex max-h-full w-[280px] min-w-[280px] flex-col overflow-hidden rounded-lg border',
        isBottleneck ? 'border-priority-high/40 bg-priority-high/5' : 'border-border bg-surface',
      )}
    >
      {/* Header */}
      <div
        className="flex flex-col gap-2 bg-raised px-3 py-4"
        style={{ borderBottom: `2px solid ${COL_COLORS[columnId] || 'var(--color-border)'}` }}
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fg">
            {title}
            {['backlog', 'todo'].includes(columnId) && (
              <Can permission={canCreateTask}>
                <button
                  onClick={() => onAddTask(columnId)}
                  className="flex h-5 w-5 items-center justify-center rounded bg-accent-soft text-base leading-none text-accent transition-colors hover:bg-accent hover:text-accent-fg"
                  title={t('execution.kanban.addToColumn', { column: title })}
                >
                  +
                </button>
              </Can>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {columnId === 'in_progress' ? (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: isWipExceeded ? '#fee2e2' : 'var(--color-raised)',
                  color: isWipExceeded ? '#ef4444' : '#64748b',
                  border: isWipExceeded ? '1px solid #fca5a5' : '1px solid transparent',
                }}
              >
                {wipCount}/{wipLimit}
              </span>
            ) : (
              <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-semibold text-muted">
                {tasks.length}
              </span>
            )}
          </div>
        </div>
        {isBottleneck && (
          <div
            data-testid="bottleneck-badge"
            title={t('execution.kanban.bottleneckTooltip', { avg: bottleneck.avg_hours, threshold: bottleneck.threshold_h })}
            className="inline-flex cursor-help items-center gap-1 self-start rounded-[10px] border border-priority-high/30 bg-priority-high/15 px-1.5 py-0.5 text-[10px] font-medium text-priority-high"
          >
            <span className="text-xs" aria-hidden="true">⚠</span>
            {t('execution.kanban.agingBadge', { hours: Math.round(bottleneck.avg_hours) })}
          </div>
        )}
      </div>

      {/* Área Droppable */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={cn(
              'flex min-h-[100px] flex-1 flex-col gap-2.5 overflow-y-auto p-3 transition-colors duration-200',
              snapshot.isDraggingOver && 'bg-raised',
            )}
          >
            {tasks.map((task, index) => (
              <Draggable
                key={task.id.toString()}
                draggableId={task.id.toString()}
                index={index}
                isDragDisabled={!canMoveTask(task)}
              >
                {(prov, snap) => (
                  <TaskCard task={task} provided={prov} isDragging={snap.isDragging} onOpen={onTaskClick} />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default KanbanColumn;
