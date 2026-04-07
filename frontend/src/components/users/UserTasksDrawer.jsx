import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { getAdminUserTasks, getAdminUserStats } from '../../services/api';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const UserTasksDrawer = ({ user, onClose }) => {
  const [filterStatus, setFilterStatus] = useState('all'); // all, in_progress, blocked, done
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

  const { data: stats } = useSWR(
    user ? `/api/v1/admin/users/${user.id}/stats` : null,
    () => getAdminUserStats(user.id)
  );

  const { data: tasks } = useSWR(
    user ? `/api/v1/admin/users/${user.id}/tasks?status=${filterStatus === 'all' ? '' : filterStatus}` : null,
    () => getAdminUserTasks(user.id, { status: filterStatus === 'all' ? null : filterStatus })
  );

  // Agrupar tareas por proyecto
  const groupedTasks = React.useMemo(() => {
    if (!tasks) return {};
    return tasks.reduce((acc, t) => {
      if (!acc[t.project_name]) acc[t.project_name] = [];
      acc[t.project_name].push(t);
      return acc;
    }, {});
  }, [tasks]);

  return (
    <>
      {/* Overlay */}
      <div 
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 50, opacity: isOpen ? 1 : 0, transition: 'opacity 200ms ease-out'
        }}
      />

      {/* Panel */}
            <div data-testid="user-tasks-drawer" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '520px', maxWidth: '100vw', backgroundColor: '#ffffff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 51,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease-out',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
              <div data-testid="user-tasks-drawer" style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div data-testid="user-tasks-drawer" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div data-testid="user-tasks-drawer" style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: user?.color || '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 600 }}>
              {getInitials(user?.name)}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#0f172a' }}>{user?.name}</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>{user?.email}</p>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Stats Row */}
              <div data-testid="user-tasks-drawer" style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
                <div data-testid="user-tasks-drawer" style={{ flex: 1, backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div data-testid="user-tasks-drawer" style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>{stats?.completed_tasks || 0}</div>
                  <div data-testid="user-tasks-drawer" style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>Completadas</div>
          </div>
                <div data-testid="user-tasks-drawer" style={{ flex: 1, backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div data-testid="user-tasks-drawer" style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>{stats?.in_progress_tasks || 0}</div>
                  <div data-testid="user-tasks-drawer" style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>En Progreso</div>
          </div>
                <div data-testid="user-tasks-drawer" style={{ flex: 1, backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div data-testid="user-tasks-drawer" style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>{stats?.total_logged_hours || 0}h</div>
                  <div data-testid="user-tasks-drawer" style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>Horas</div>
          </div>
                <div data-testid="user-tasks-drawer" style={{ flex: 1, backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div data-testid="user-tasks-drawer" style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>{stats?.completion_rate || 0}%</div>
                  <div data-testid="user-tasks-drawer" style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>Completitud</div>
          </div>
        </div>

        {/* Filters */}
              <div data-testid="user-tasks-drawer" style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'in_progress', label: 'En Progreso' },
            { id: 'blocked', label: 'Bloqueadas' },
            { id: 'done', label: 'Completadas' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: filterStatus === f.id ? '#6366f1' : '#cbd5e1',
                backgroundColor: filterStatus === f.id ? '#e0e7ff' : '#ffffff',
                color: filterStatus === f.id ? '#4f46e5' : '#475569',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tasks List */}
              <div data-testid="user-tasks-drawer" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {!tasks ? (
                  <div data-testid="user-tasks-drawer" style={{ textAlign: 'center', color: '#94a3b8' }}>Cargando tareas...</div>
          ) : Object.keys(groupedTasks).length === 0 ? (
                  <div data-testid="user-tasks-drawer" style={{ textAlign: 'center', color: '#94a3b8' }}>No hay tareas asignadas en este estado.</div>
          ) : (
            Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
              <div key={projectName} style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                  {projectName}
                </h4>
                      <div data-testid="user-tasks-drawer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {projectTasks.map(t => {
                    let bg = '#ffffff';
                    if (t.status === 'in_progress') bg = '#eff6ff';
                    if (t.status === 'blocked') bg = '#fef2f2';

                    return (
                      <div key={t.id} style={{ 
                        padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', 
                        backgroundColor: bg, display: 'flex', flexDirection: 'column', gap: '8px'
                      }}>
                              <div data-testid="user-tasks-drawer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'capitalize', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            {t.status.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                            {t.priority}
                          </span>
                        </div>
                              <div data-testid="user-tasks-drawer" style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a' }}>{t.title}</div>
                              <div data-testid="user-tasks-drawer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <Link 
                            to={`/projects/${t.project_id}/board`} 
                            style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}
                          >
                            Ver en Kanban →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default UserTasksDrawer;
