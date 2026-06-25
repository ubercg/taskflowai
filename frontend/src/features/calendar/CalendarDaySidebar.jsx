import { format } from 'date-fns';

const STATUS_STYLE = {
  backlog:     { bg: '#f1f5f9', color: '#475569', label: 'Backlog' },
  todo:        { bg: '#e0e7ff', color: '#1e40af', label: 'To Do' },
  in_progress: { bg: '#fef3c7', color: '#b45309', label: 'In Progress' },
  review:      { bg: '#f3e8ff', color: '#6b21a8', label: 'Review' },
  done:        { bg: '#dcfce3', color: '#166534', label: 'Done' },
  blocked:     { bg: '#fee2e2', color: '#b91c1c', label: 'Blocked' },
};

function CalendarDaySidebar({ tasks = [] }) {
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => {
        const s = STATUS_STYLE[task.status] || { bg: '#e2e8f0', color: '#0f172a', label: task.status };
        const time = task.due_date ? format(new Date(task.due_date), 'HH:mm') : null;
        return (
          <div key={task.id} className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]" style={{ borderLeft: '3px solid ' + s.color }}>
            {time && <div className="mb-0.5 text-muted">{time}</div>}
            <div className="mb-0.5 font-medium text-fg">{task.title}</div>
            <span className="rounded-full px-1.5 text-[10px] font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default CalendarDaySidebar;
