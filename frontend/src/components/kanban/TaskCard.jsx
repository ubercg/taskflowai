import { parseDateOnly, formatCalendarShortEs } from '../../utils/dateUtils';
import { cn } from '../../lib/cn';

// Colores de prioridad (se aplican inline porque el borde y el punto son dinámicos)
const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

// Estado de fecha límite. Devuelve colores literales: los tests verifican el
// color inline del badge (toHaveStyle), por lo que NO migran a clases Tailwind.
const getDueDateStatus = (dueDateStr) => {
  if (!dueDateStr) return null;
  const due = parseDateOnly(dueDateStr);
  if (!due || Number.isNaN(due.getTime())) return null;
  const now = new Date();

  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffDays = Math.ceil((dueDay - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { color: '#ef4444', bg: '#fee2e2' }; // Vencido
  if (diffDays <= 3) return { color: '#d97706', bg: '#fef3c7' }; // Pronto
  return { color: '#64748b', bg: '#f1f5f9' }; // Futuro
};

const TaskCard = ({ task, onOpen, isDragging, provided }) => {
  const priority = task.priority || 'medium';
  const priorityColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  let subtasksProgress = 0;
  if (hasSubtasks) {
    const subtasksDone = task.subtasks.filter((st) => st.status === 'done').length;
    subtasksProgress = (subtasksDone / task.subtasks.length) * 100;
  }

  const logged = parseFloat(task.logged_hours || 0);
  const estimated = task.estimated_hours ? parseFloat(task.estimated_hours) : null;
  const isOvertime = estimated !== null && logged > estimated;

  const dueDateStatus = getDueDateStatus(task.due_date);

  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      data-testid="task-card"
      onClick={() => onOpen && onOpen(task.id)}
      className={cn(
        'relative flex select-none flex-col gap-2 rounded-lg bg-surface p-3',
        'border border-border shadow-soft transition-all duration-150',
        'cursor-grab active:cursor-grabbing hover:border-accent',
        isDragging && 'border-accent shadow-raised',
      )}
      style={{ borderLeft: `3px solid ${priorityColor}`, ...provided?.draggableProps?.style }}
    >
      {/* Header: chips & prioridad */}
      <div className="flex items-start justify-between">
        <div className="flex flex-1 flex-wrap gap-1">
          {task.objective_id && (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-review/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-review">
              🎯 OKR #{task.objective_id}
            </span>
          )}

          {task.due_date && dueDateStatus && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: dueDateStatus.bg, color: dueDateStatus.color }}
            >
              {formatCalendarShortEs(task.due_date)}
            </span>
          )}
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priorityColor }} />
          <span className="text-[11px] font-medium capitalize text-muted">{priority}</span>
        </div>
      </div>

      {/* Título */}
      <h4 className="my-1 line-clamp-2 break-words text-sm font-medium leading-snug text-fg">
        {task.title}
      </h4>

      {/* Footer: responsable & horas */}
      <div className="mt-1 flex items-end justify-between">
        {task.assignee ? (
          <div
            title={task.assignee.name}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-1 ring-surface"
            style={{ backgroundColor: task.assignee.color || 'var(--color-faint)' }}
          >
            {getInitials(task.assignee.name)}
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border bg-raised">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-faint">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        )}

        <div className={cn('flex items-center gap-1 text-[11px] font-medium', isOvertime ? 'text-status-blocked' : 'text-muted')}>
          {isOvertime && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          )}
          {estimated !== null ? <span>{logged}h / {estimated}h</span> : <span>{logged}h registradas</span>}
        </div>
      </div>

      {/* Barra de progreso de subtareas */}
      {hasSubtasks && (
        <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-[7px] bg-raised">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${subtasksProgress}%`,
              backgroundColor:
                subtasksProgress === 100 ? '#22c55e' : subtasksProgress > 0 ? '#3b82f6' : '#cbd5e1',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default TaskCard;
