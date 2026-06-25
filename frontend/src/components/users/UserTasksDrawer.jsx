import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { getAdminUserTasks, getAdminUserStats } from '../../services/api';
import { cn } from '../../lib/cn';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'in_progress', label: 'En Progreso' },
  { id: 'blocked', label: 'Bloqueadas' },
  { id: 'done', label: 'Completadas' },
];

const UserTasksDrawer = ({ user, onClose }) => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200);
  };

  const { data: stats } = useSWR(user ? `/api/v1/admin/users/${user.id}/stats` : null, () => getAdminUserStats(user.id));
  const { data: tasks } = useSWR(
    user ? `/api/v1/admin/users/${user.id}/tasks?status=${filterStatus === 'all' ? '' : filterStatus}` : null,
    () => getAdminUserTasks(user.id, { status: filterStatus === 'all' ? null : filterStatus }),
  );

  const groupedTasks = useMemo(() => {
    if (!tasks) return {};
    return tasks.reduce((acc, t) => {
      if (!acc[t.project_name]) acc[t.project_name] = [];
      acc[t.project_name].push(t);
      return acc;
    }, {});
  }, [tasks]);

  const statBox = (value, label) => (
    <div className="flex-1 rounded-lg bg-canvas p-3">
      <div className="text-lg font-semibold text-fg">{value}</div>
      <div className="mt-1 text-[11px] uppercase text-muted">{label}</div>
    </div>
  );

  return createPortal(
    <>
      <div
        onClick={handleClose}
        className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: isOpen ? 1 : 0 }}
      />

      <div
        data-testid="user-tasks-drawer"
        className="fixed inset-y-0 right-0 z-[51] flex w-[520px] max-w-full flex-col border-l border-border bg-surface shadow-overlay transition-transform duration-200"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white" style={{ backgroundColor: user?.color || '#6366f1' }}>
              {getInitials(user?.name)}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-fg">{user?.name}</h2>
              <p className="mt-0.5 text-[13px] text-muted">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-muted transition-colors hover:text-fg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 border-b border-border p-6">
          {statBox(stats?.completed_tasks || 0, 'Completadas')}
          {statBox(stats?.in_progress_tasks || 0, 'En Progreso')}
          {statBox(`${stats?.total_logged_hours || 0}h`, 'Horas')}
          {statBox(`${stats?.completion_rate || 0}%`, 'Completitud')}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 border-b border-border px-6 py-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                filterStatus === f.id ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-muted hover:text-fg',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-6">
          {!tasks ? (
            <div className="text-center text-faint">Cargando tareas...</div>
          ) : Object.keys(groupedTasks).length === 0 ? (
            <div className="text-center text-faint">No hay tareas asignadas en este estado.</div>
          ) : (
            Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
              <div key={projectName} className="mb-6">
                <h4 className="mb-3 border-b border-border pb-1 text-[13px] font-semibold uppercase text-muted">{projectName}</h4>
                <div className="flex flex-col gap-2">
                  {projectTasks.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        'flex flex-col gap-2 rounded-lg border border-border p-3',
                        t.status === 'in_progress' && 'bg-status-in_progress/5',
                        t.status === 'blocked' && 'bg-status-blocked/5',
                        t.status !== 'in_progress' && t.status !== 'blocked' && 'bg-surface',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] font-semibold capitalize text-muted">{t.status.replace('_', ' ')}</span>
                        <span className="text-xs text-faint">{t.priority}</span>
                      </div>
                      <div className="text-sm font-medium text-fg">{t.title}</div>
                      <div className="mt-1 flex justify-end">
                        <Link to={`/projects/${t.project_id}/board`} className="text-xs font-medium text-accent hover:text-accent-hover">Ver en Kanban →</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  );
};

export default UserTasksDrawer;
