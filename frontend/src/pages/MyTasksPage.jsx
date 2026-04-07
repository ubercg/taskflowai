import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth } from '../store/authStore';
import api from '../services/api/client';
import { getProjects } from '../services/api';
import TaskModal from '../features/execution/TaskModal';
import TimeLogWidget from '../features/operations/TimeLogWidget';
import { formatCalendarShortEs } from '../utils/dateUtils';

const STATUS_ORDER = ['in_progress', 'blocked', 'review', 'todo', 'backlog', 'done'];

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

function isCompletedToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

const MyTasksPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('status'); // status | project | priority
  const [expandedSections, setExpandedSections] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTimeLogWidget, setActiveTimeLogWidget] = useState(null);

  const { data: tasks, isLoading, mutate } = useSWR(
    user ? `/api/v1/tasks?assignee_id=${user.id}` : null,
    () => api.get(`/api/v1/tasks?assignee_id=${user.id}`).then((res) => res.data)
  );

  const { data: velocity } = useSWR(
    user ? `/api/v1/metrics/velocity` : null,
    () => api.get('/api/v1/metrics/velocity').then((res) => res.data)
  );

  const { data: projects } = useSWR(user ? '/api/v1/projects' : null, getProjects);

  const userVelocity = useMemo(() => {
    if (!velocity?.length || user?.id == null) return null;
    return velocity.find((v) => Number(v.user_id) === Number(user.id)) ?? null;
  }, [velocity, user?.id]);

  const projectNameById = useMemo(() => {
    const map = {};
    (projects || []).forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [projects]);

  const myTasks = tasks || [];

  const groupedByStatus = useMemo(() => {
    return myTasks.reduce((acc, task) => {
      const s = task.status || 'backlog';
      if (!acc[s]) acc[s] = [];
      acc[s].push(task);
      return acc;
    }, {});
  }, [myTasks]);

  const stats = useMemo(() => {
    const count = (k) => (groupedByStatus[k] ? groupedByStatus[k].length : 0);
    const doneToday = myTasks.filter(
      (t) => t.status === 'done' && isCompletedToday(t.completed_at)
    ).length;
    return {
      inProgress: count('in_progress'),
      todo: count('todo'),
      backlog: count('backlog'),
      doneTotal: count('done'),
      doneToday,
      total: myTasks.length,
      hoursWeek: userVelocity?.total_hours ?? 0,
    };
  }, [myTasks, groupedByStatus, userVelocity]);

  const groupedByProjectId = useMemo(() => {
    return myTasks.reduce((acc, task) => {
      const pid = task.project_id;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(task);
      return acc;
    }, {});
  }, [myTasks]);

  const groupedByPriority = useMemo(() => {
    return myTasks.reduce((acc, task) => {
      const p = task.priority || 'medium';
      if (!acc[p]) acc[p] = [];
      acc[p].push(task);
      return acc;
    }, {});
  }, [myTasks]);

  const toggleSection = (status) => {
    setExpandedSections((prev) => {
      const groupTasks = groupedByStatus[status] || [];
      const current =
        prev[status] !== undefined ? prev[status] : groupTasks.length > 0;
      return { ...prev, [status]: !current };
    });
  };

  const getStatusInfo = (status) => {
    const map = {
      in_progress: { label: 'En progreso', icon: '🔵', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
      todo: { label: 'Por hacer', icon: '🟡', color: '#a16207', bg: '#fefce8', border: '#fde047' },
      blocked: { label: 'Bloqueadas', icon: '🔴', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
      review: { label: 'En revisión', icon: '🟣', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
      backlog: { label: 'Backlog', icon: '⚪', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
      done: { label: 'Completadas', icon: '✅', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
    };
    return map[status] || map.backlog;
  };

  const getPriorityInfo = (priority) => {
    const map = {
      critical: { label: 'Crítica', dot: '#ef4444' },
      high: { label: 'Alta', dot: '#f97316' },
      medium: { label: 'Media', dot: '#eab308' },
      low: { label: 'Baja', dot: '#22c55e' },
    };
    return map[priority] || map.medium;
  };

  const handleLogged = (newLog) => {
    const list = tasks || [];
    mutate(
      list.map((t) =>
        t.id === newLog.task_id ? { ...t, logged_hours: (t.logged_hours || 0) + newLog.hours } : t
      ),
      false
    );
    alert(`✓ ${newLog.hours}h registradas en la tarea`);
    mutate();
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Cargando tus tareas...</div>;

  const firstName = user?.name?.split(' ')[0] ?? 'Usuario';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#0f172a',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Mis Tareas
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b', margin: 0 }}>
            Hola, {firstName} 👋
          </p>
        </div>
      </div>

      {/* KPIs: mismos datos que la lista (tareas) + horas de la métrica de velocity */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            padding: '14px 16px',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>En progreso</span>
          <span style={{ fontSize: '26px', fontWeight: 700, color: '#1d4ed8', lineHeight: 1.1 }}>
            {stats.inProgress}
          </span>
        </div>
        <div
          style={{
            backgroundColor: '#fefce8',
            border: '1px solid #fde047',
            padding: '14px 16px',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#a16207', fontWeight: 600 }}>Por hacer</span>
          <span style={{ fontSize: '26px', fontWeight: 700, color: '#854d0e', lineHeight: 1.1 }}>
            {stats.todo}
          </span>
        </div>
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            padding: '14px 16px',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Completadas hoy</span>
          <span style={{ fontSize: '26px', fontWeight: 700, color: '#15803d', lineHeight: 1.1 }}>
            {stats.doneToday}
          </span>
        </div>
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '14px 16px',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Horas esta semana</span>
          <span style={{ fontSize: '26px', fontWeight: 700, color: '#334155', lineHeight: 1.1 }}>
            {typeof stats.hoursWeek === 'number' ? stats.hoursWeek.toFixed(1) : '0'}h
          </span>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: '#64748b', margin: '-12px 0 24px 0' }}>
        {stats.total === 0
          ? 'No tienes tareas asignadas.'
          : `${stats.total} tarea${stats.total === 1 ? '' : 's'} asignada${stats.total === 1 ? '' : 's'}`}
      </p>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px',
          marginBottom: '24px',
        }}
      >
        {['status', 'project', 'priority'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: activeTab === tab ? '1px solid #cbd5e1' : '1px solid transparent',
              backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
              color: activeTab === tab ? '#0f172a' : '#64748b',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            Por {tab === 'status' ? 'Estado' : tab === 'project' ? 'Proyecto' : 'Prioridad'}
          </button>
        ))}
      </div>

      {myTasks.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '64px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#0f172a',
              margin: '0 0 8px 0',
            }}
          >
            No tienes tareas asignadas
          </h3>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
            Tu bandeja está limpia. Disfruta tu día o busca algo en qué trabajar.
          </p>
          <Link
            to="/projects"
            style={{
              display: 'inline-block',
              backgroundColor: '#6366f1',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '14px',
            }}
          >
            Ver todos los proyectos
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '64px' }}>
          {activeTab === 'status' &&
            STATUS_ORDER.map((status) => {
              const groupTasks = groupedByStatus[status] || [];
              const info = getStatusInfo(status);
              const isExpanded =
                expandedSections[status] !== undefined
                  ? expandedSections[status]
                  : groupTasks.length > 0;

              return (
                <div
                  key={status}
                  style={{
                    border: `1px solid ${info.border}`,
                    borderRadius: '12px',
                    backgroundColor: '#fff',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(status)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      backgroundColor: info.bg,
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRadius: isExpanded ? '0' : '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{info.icon}</span>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: info.color }}>
                        {info.label} ({groupTasks.length})
                      </span>
                    </div>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={info.color}
                      strokeWidth="2"
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isExpanded &&
                    (groupTasks.length === 0 ? (
                      <div
                        style={{
                          padding: '20px 16px',
                          textAlign: 'center',
                          fontSize: '13px',
                          color: '#94a3b8',
                          borderTop: '1px solid #f1f5f9',
                        }}
                      >
                        No hay tareas en este estado
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {groupTasks.map((task) => {
                          const pInfo = getPriorityInfo(task.priority);
                          return (
                            <div
                              key={task.id}
                              style={{
                                padding: '16px',
                                borderTop: '1px solid #f1f5f9',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '8px',
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '50%',
                                      backgroundColor: pInfo.dot,
                                      flexShrink: 0,
                                    }}
                                    title={pInfo.label}
                                  />
                                  <h4
                                    onClick={() => setSelectedTask(task.id)}
                                    style={{
                                      margin: 0,
                                      fontSize: '15px',
                                      fontWeight: 500,
                                      color: '#0f172a',
                                      cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.textDecoration = 'underline';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.textDecoration = 'none';
                                    }}
                                  >
                                    {task.title}
                                  </h4>
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    fontSize: '12px',
                                    color: '#64748b',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span>
                                    📁{' '}
                                    {projectNameById[task.project_id] || `Proyecto ${task.project_id}`}
                                  </span>
                                  {task.objective_id && (
                                    <span
                                      style={{
                                        color: '#5b21b6',
                                        backgroundColor: '#ede9fe',
                                        padding: '2px 6px',
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      🎯 OKR #{task.objective_id}
                                    </span>
                                  )}
                                  <span>
                                    📅 {task.due_date ? formatCalendarShortEs(task.due_date) : 'Sin fecha'}
                                  </span>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '16px',
                                  flexShrink: 0,
                                }}
                              >
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                    {task.logged_hours || 0}h
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    / {task.estimated_hours ?? '-'}h est.
                                  </div>
                                </div>

                                <div style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveTimeLogWidget(activeTimeLogWidget === task.id ? null : task.id)
                                    }
                                    style={{
                                      padding: '8px 12px',
                                      backgroundColor: '#f8fafc',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '6px',
                                      color: '#475569',
                                      fontSize: '13px',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ⏱ Registrar
                                  </button>

                                  {activeTimeLogWidget === task.id && (
                                    <TimeLogWidget
                                      task={task}
                                      onClose={() => setActiveTimeLogWidget(null)}
                                      onLogged={handleLogged}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                </div>
              );
            })}

          {activeTab === 'project' &&
            Object.entries(groupedByProjectId).map(([projectId, groupTasks]) => {
              const name = projectNameById[Number(projectId)] || `Proyecto ${projectId}`;
              return (
                <div
                  key={projectId}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    backgroundColor: '#fff',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      fontWeight: 600,
                      color: '#334155',
                    }}
                  >
                    📁 {name} ({groupTasks.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {groupTasks.map((task) => {
                      const pInfo = getPriorityInfo(task.priority);
                      return (
                        <div
                          key={task.id}
                          style={{
                            padding: '16px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '8px',
                              }}
                            >
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: pInfo.dot,
                                }}
                                title={pInfo.label}
                              />
                              <h4
                                onClick={() => setSelectedTask(task.id)}
                                style={{
                                  margin: 0,
                                  fontSize: '15px',
                                  fontWeight: 500,
                                  color: '#0f172a',
                                  cursor: 'pointer',
                                }}
                              >
                                {task.title}
                              </h4>
                            </div>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveTimeLogWidget(activeTimeLogWidget === task.id ? null : task.id)
                              }
                              style={{
                                padding: '8px 12px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                color: '#475569',
                                fontSize: '13px',
                                cursor: 'pointer',
                              }}
                            >
                              ⏱ Registrar
                            </button>
                            {activeTimeLogWidget === task.id && (
                              <TimeLogWidget
                                task={task}
                                onClose={() => setActiveTimeLogWidget(null)}
                                onLogged={handleLogged}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {activeTab === 'priority' &&
            ['critical', 'high', 'medium', 'low'].map((priority) => {
              const groupTasks = groupedByPriority[priority] || [];
              if (groupTasks.length === 0) return null;
              const pInfo = getPriorityInfo(priority);

              return (
                <div
                  key={priority}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    backgroundColor: '#fff',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      fontWeight: 600,
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: pInfo.dot,
                      }}
                    />
                    {pInfo.label} ({groupTasks.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {groupTasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          padding: '16px',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            onClick={() => setSelectedTask(task.id)}
                            style={{
                              margin: 0,
                              fontSize: '15px',
                              fontWeight: 500,
                              color: '#0f172a',
                              cursor: 'pointer',
                            }}
                          >
                            {task.title}
                          </h4>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveTimeLogWidget(activeTimeLogWidget === task.id ? null : task.id)
                            }
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              color: '#475569',
                              fontSize: '13px',
                              cursor: 'pointer',
                            }}
                          >
                            ⏱ Registrar
                          </button>
                          {activeTimeLogWidget === task.id && (
                            <TimeLogWidget
                              task={task}
                              onClose={() => setActiveTimeLogWidget(null)}
                              onLogged={handleLogged}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {selectedTask && (
        <TaskModal taskId={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
};

export default MyTasksPage;
