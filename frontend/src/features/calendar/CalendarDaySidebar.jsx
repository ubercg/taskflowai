import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function CalendarDaySidebar({ selectedDay, tasks }) {
  const getStatusStyle = (status) => {
    const styles = {
      backlog: { backgroundColor: '#f1f5f9', color: '#475569' },
      todo: { backgroundColor: '#e0e7ff', color: '#1e40af' },
      in_progress: { backgroundColor: '#fef3c7', color: '#b45309' },
      review: { backgroundColor: '#f3e8ff', color: '#6b21a8' },
      done: { backgroundColor: '#dcfce3', color: '#166534' },
      blocked: { backgroundColor: '#fee2e2', color: '#b91c1c' },
    };
    return styles[status] || { backgroundColor: '#e2e8f0', color: '#0f172a' };
  };

  const getStatusLabel = (status) => {
    const labels = {
      backlog: 'Backlog',
      todo: 'To Do',
      in_progress: 'In Progress',
      review: 'Review',
      done: 'Done',
      blocked: 'Blocked',
    };
    return labels[status] || status;
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', height: '100%', border: '1px solid #e2e8f0' }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#334155', marginBottom: '1rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>
        {selectedDay ? format(selectedDay, "EEEE d 'de' MMMM", { locale: es }) : 'Selecciona un día'}
      </h3>

      {tasks.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No hay tareas para este día.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tasks.map((task) => (
            <div key={task.id} style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '0.375rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 500, color: '#0f172a', marginBottom: '0.5rem' }}>{task.title}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <span style={{ 
                  ...getStatusStyle(task.status),
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                  fontWeight: 500
                }}>
                  {getStatusLabel(task.status)}
                </span>
                {task.due_date && (
                  <span style={{ color: '#64748b' }}>
                    Vence: {format(new Date(task.due_date), 'HH:mm')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CalendarDaySidebar;
