import React from 'react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {tasks.map((task) => {
        const s = STATUS_STYLE[task.status] || { bg: '#e2e8f0', color: '#0f172a', label: task.status };
        const time = task.due_date ? format(new Date(task.due_date), 'HH:mm') : null;
        return (
          <div
            key={task.id}
            style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderLeft: '3px solid ' + s.color,
              borderRadius: '4px',
              padding: '4px 6px',
              fontSize: '11px',
            }}
          >
            {time && <div style={{ color: '#64748b', marginBottom: '2px' }}>{time}</div>}
            <div style={{ fontWeight: 500, color: '#0f172a', marginBottom: '2px' }}>{task.title}</div>
            <span
              style={{
                backgroundColor: s.bg,
                color: s.color,
                padding: '1px 6px',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: 500,
              }}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default CalendarDaySidebar;
