import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth } from '../store/authStore';
import api from '../services/api/client';
import TaskModal from '../features/execution/TaskModal';
import TimeLogWidget from '../features/operations/TimeLogWidget';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const MyTasksPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('status'); // status | project | priority
  const [expandedSections, setExpandedSections] = useState({ in_progress: true });
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTimeLogWidget, setActiveTimeLogWidget] = useState(null); // task.id

  const { data: tasks, isLoading, mutate } = useSWR(
    user ? `/api/v1/tasks?assignee_id=${user.id}` : null,
    () => api.get(`/api/v1/tasks?assignee_id=${user.id}`).then(res => res.data)
  );

  const { data: velocity } = useSWR(
    user ? `/api/v1/metrics/velocity` : null,
    () => api.get('/api/v1/metrics/velocity').then(res => res.data)
  );

  const userVelocity = velocity?.find(v => v.user_id === user.id) || {
    in_progress: 0, completed: 0, total_hours: 0
  };

  const myTasks = tasks || [];

  const groupedByStatus = myTasks.reduce((acc, task) => {
    const s = task.status || 'backlog';
    if (!acc[s]) acc[s] = [];
    acc[s].push(task);
    return acc;
  }, {});

  const groupedByProject = myTasks.reduce((acc, task) => {
    // Assuming backend returns project_name for these tasks, if not, we use project_id as a fallback
    // The instructions don't say to fetch projects, but to group by project.
    // For now, let's group by project_id and we could map to names if we had them.
    const p = `Proyecto ${task.project_id}`; 
    if (!acc[p]) acc[p] = [];
    acc[p].push(task);
    return acc;
  }, {});

  const groupedByPriority = myTasks.reduce((acc, task) => {
    const p = task.priority || 'medium';
    if (!acc[p]) acc[p] = [];
    acc[p].push(task);
    return acc;
  }, {});

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusInfo = (status) => {
    const map = {
      in_progress: { label: 'En progreso', icon: '🔵', color: '#3b82f6', bg: '#eff6ff' },
      todo: { label: 'Por hacer', icon: '🟡', color: '#eab308', bg: '#fefce8' },
      blocked: { label: 'Bloqueadas', icon: '🔴', color: '#ef4444', bg: '#fef2f2' },
      backlog: { label: 'Backlog', icon: '⚪', color: '#64748b', bg: '#f8fafc' },
      done: { label: 'Completadas', icon: '✅', color: '#22c55e', bg: '#f0fdf4' }
    };
    return map[status] || map.backlog;
  };

  const getPriorityInfo = (priority) => {
    const map = {
      critical: { label: 'Crítica', dot: '#ef4444' },
      high: { label: 'Alta', dot: '#f97316' },
      medium: { label: 'Media', dot: '#eab308' },
      low: { label: 'Baja', dot: '#22c55e' }
    };
    return map[priority] || map.medium;
  };

  const handleLogged = (newLog) => {
    mutate(tasks.map(t => t.id === newLog.task_id ? { ...t, logged_hours: (t.logged_hours || 0) + newLog.hours } : t), false);
    // Simple toast
    alert(`✓ ${newLog.hours}h registradas en la tarea`);
    mutate(); // revalidar background
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Cargando tus tareas...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 16px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
            Mis Tareas
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b', margin: 0 }}>
            Hola, {user?.name.split(' ')[0]} 👋
          </p>
        </div>
      </div>

      {/* Stats Chips */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px 16px', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', color: '#1e40af', fontWeight: 600 }}>En progreso</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8' }}>{userVelocity.in_progress}</span>
        </div>
        <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', padding: '12px 16px', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', color: '#a16207', fontWeight: 600 }}>Por hacer</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#854d0e' }}>{groupedByStatus['todo']?.length || 0}</span>
        </div>
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>Completadas hoy</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#15803d' }}>{userVelocity.completed}</span>
        </div>
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>Horas esta semana</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#334155' }}>{userVelocity.total_hours}h</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
        {['status', 'project', 'priority'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', borderRadius: '20px', 
              border: activeTab === tab ? '1px solid #cbd5e1' : '1px solid transparent',
              backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
              color: activeTab === tab ? '#0f172a' : '#64748b',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            Por {tab === 'status' ? 'Estado' : tab === 'project' ? 'Proyecto' : 'Prioridad'}
          </button>
        ))}
      </div>

      {/* Content */}
      {myTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', backgroundColor: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: '0 0 8px 0' }}>No tienes tareas asignadas</h3>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Tu bandeja está limpia. Disfruta tu día o busca algo en qué trabajar.</p>
          <Link to="/projects" style={{ display: 'inline-block', backgroundColor: '#6366f1', color: '#fff', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: 500, fontSize: '14px' }}>
            Ver todos los proyectos
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '64px' }}>
          {/* Por Estado */}
          {activeTab === 'status' && ['in_progress', 'todo', 'blocked', 'backlog', 'done'].map(status => {
            const groupTasks = groupedByStatus[status] || [];
            if (groupTasks.length === 0) return null;
            const info = getStatusInfo(status);
            const isExpanded = expandedSections[status] !== false; // if undefined, true

            return (
              <div key={status} style={{ border: `1px solid ${info.bg === '#f8fafc' ? '#e2e8f0' : info.bg.replace('f', 'd')}`, borderRadius: '12px', backgroundColor: '#fff' }}>
                <button 
                  onClick={() => toggleSection(status)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: info.bg, border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: isExpanded ? '12px 12px 0 0' : '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{info.icon}</span>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: info.color }}>{info.label} ({groupTasks.length})</span>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {groupTasks.map(task => {
                      const pInfo = getPriorityInfo(task.priority);
                      return (
                      <div key={task.id} style={{ padding: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: pInfo.dot }} title={pInfo.label} />
                            <h4 
                              onClick={() => setSelectedTask(task.id)}
                              style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#0f172a', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            >
                              {task.title}
                            </h4>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                            <span>📁 Proyecto {task.project_id}</span>
                            {task.objective_id && <span style={{ color: '#5b21b6', backgroundColor: '#ede9fe', padding: '2px 6px', borderRadius: '12px', fontWeight: 600 }}>🎯 OKR #{task.objective_id}</span>}
                            <span>📅 {task.due_date ? new Date(task.due_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Sin fecha'}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{task.logged_hours || 0}h</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>/ {task.estimated_hours || '-'}h est.</div>
                          </div>
                          
                          <div style={{ position: 'relative' }}>
                            <button 
                              onClick={() => setActiveTimeLogWidget(activeTimeLogWidget === task.id ? null : task.id)}
                              style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                            >
                              ⏱ Registrar
                            </button>
                            
                            {activeTimeLogWidget === task.id && (
                              <TimeLogWidget task={task} onClose={() => setActiveTimeLogWidget(null)} onLogged={handleLogged} />
                            )}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            );
          })}

          {/* Por Proyecto */}
          {activeTab === 'project' && Object.entries(groupedByProject).map(([projectName, groupTasks]) => (
            <div key={projectName} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#fff' }}>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#334155', borderRadius: '12px 12px 0 0' }}>
                {projectName} ({groupTasks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {groupTasks.map(task => {
                  const pInfo = getPriorityInfo(task.priority);
                  return (
                  <div key={task.id} style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: pInfo.dot }} title={pInfo.label} />
                        <h4 
                          onClick={() => setSelectedTask(task.id)}
                          style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#0f172a', cursor: 'pointer' }}
                        >
                          {task.title}
                        </h4>
                      </div>
                    </div>
                    {/* Simplified right side for other tabs to keep code short, reuse same structure */}
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setActiveTimeLogWidget(activeTimeLogWidget === task.id ? null : task.id)} style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569', fontSize: '13px', cursor: 'pointer' }}>
                        ⏱ Registrar
                      </button>
                      {activeTimeLogWidget === task.id && <TimeLogWidget task={task} onClose={() => setActiveTimeLogWidget(null)} onLogged={handleLogged} />}
                    </div>
                  </div>
                )})}
              </div>
            </div>
          ))}

          {/* Por Prioridad */}
          {activeTab === 'priority' && ['critical', 'high', 'medium', 'low'].map(priority => {
            const groupTasks = groupedByPriority[priority] || [];
            if (groupTasks.length === 0) return null;
            const pInfo = getPriorityInfo(priority);

            return (
            <div key={priority} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#fff' }}>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px 12px 0 0' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: pInfo.dot }} />
                {pInfo.label} ({groupTasks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {groupTasks.map(task => (
                  <div key={task.id} style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <h4 onClick={() => setSelectedTask(task.id)} style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#0f172a', cursor: 'pointer' }}>
                        {task.title}
                      </h4>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setActiveTimeLogWidget(activeTimeLogWidget === task.id ? null : task.id)} style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569', fontSize: '13px', cursor: 'pointer' }}>
                        ⏱ Registrar
                      </button>
                      {activeTimeLogWidget === task.id && <TimeLogWidget task={task} onClose={() => setActiveTimeLogWidget(null)} onLogged={handleLogged} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )})}
        </div>
      )}

      {selectedTask && (
        <TaskModal taskId={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
};

export default MyTasksPage;
