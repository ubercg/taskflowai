import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { getTask, updateTask, deleteTask, getTimeLogs, createTimeLog } from '../../services/api';
import api from '../../services/api/client';
import { toDateInputValue, formatCalendarLocale } from '../../utils/dateUtils';

import usePermissions from '../../hooks/usePermissions';

import { useAuth } from '../../store/authStore';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const TaskModal = ({ taskId, onClose }) => {
  const { canAssignTask, canDeleteTask, canLogTime, editableFields } = usePermissions();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newLogHours, setNewLogHours] = useState('');
  const [newLogDesc, setNewLogDesc] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const saveTimeoutRef = useRef(null);

  const { data: task, error, mutate } = useSWR(
    taskId ? `/api/v1/tasks/${taskId}` : null,
    () => getTask(taskId),
    { revalidateOnFocus: false }
  );

  const { data: timeLogs, mutate: mutateLogs } = useSWR(
    taskId ? `/api/v1/time-logs?task_id=${taskId}` : null,
    () => getTimeLogs({ task_id: taskId })
  );

  const { data: activities } = useSWR(
    taskId ? `/api/v1/tasks/${taskId}/activities` : null,
    () => api.get(`/api/v1/tasks/${taskId}/activities`).then(res => res.data)
  );

  // Clave distinta a TaskListView (/api/v1/tasks?project_id=) para no compartir caché SWR:
  // si comparten clave, el fetch filtrado por parent_id sobrescribe la lista completa del tablero.
  const { data: subtasks, mutate: mutateSubtasks } = useSWR(
    task?.project_id && taskId
      ? ['task-subtasks', Number(taskId), task.project_id]
      : null,
    () =>
      api
        .get(`/api/v1/tasks?project_id=${task.project_id}`)
        .then((res) =>
          res.data.filter((t) => Number(t.parent_id) === Number(taskId))
        )
  );

  const { data: members } = useSWR(
    task?.project_id ? `/api/v1/projects/${task.project_id}/members` : null,
    () => api.get(`/api/v1/projects/${task.project_id}/members`).then(res => res.data)
  );

  const { data: objectives } = useSWR(
    task?.project_id ? `/api/v1/objectives?project_id=${task.project_id}` : null,
    () => api.get(`/api/v1/objectives?project_id=${task.project_id}`).then(res => res.data)
  );

  useEffect(() => {
    // Activar animación de entrada al montar
    requestAnimationFrame(() => setIsOpen(true));
    
    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
    }
  }, [task]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200); // Esperar que termine la animación
  };

  const handleTitleBlur = async () => {
    if (title !== task?.title) {
      try {
        await updateTask(taskId, { title });
        mutate({ ...task, title }, false);
      } catch (err) {
        console.error("Error updating title", err);
        setTitle(task?.title || '');
      }
    }
  };

  const handleDescriptionChange = (e) => {
    const val = e.target.value;
    setDescription(val);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateTask(taskId, { description: val });
        mutate({ ...task, description: val }, false);
      } catch (err) {
        console.error("Error auto-saving description", err);
      }
    }, 1000);
  };

  const handleCreateSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    try {
      await api.post('/api/v1/tasks', {
        parent_id: task.id,
        project_id: task.project_id,
        title: newSubtaskTitle,
        type: 'subtask',
        status: 'backlog'
      });
      setNewSubtaskTitle('');
      mutateSubtasks();
    } catch (err) {
      alert("Error al crear subtarea: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggleSubtask = async (subtask) => {
    const newStatus = subtask.status === 'done' ? 'backlog' : 'done';
    try {
      await api.patch(`/api/v1/tasks/${subtask.id}`, { status: newStatus });
      mutateSubtasks();
    } catch (err) {
      alert("Error al actualizar subtarea: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleLogTime = async () => {
    if (!newLogHours || isNaN(parseFloat(newLogHours))) return;
    if (!canLogTime) return;
    try {
      await createTimeLog({
        task_id: taskId,
        user_id: user?.id || 1,
        hours: parseFloat(newLogHours),
        description: newLogDesc || null,
        log_date: new Date().toISOString().split('T')[0]
      });
      // Limpiamos form y recargamos logs y tarea
      setNewLogHours('');
      setNewLogDesc('');
      mutateLogs();
      mutate();
    } catch (err) {
      alert("Error al registrar tiempo: " + (err.detail || err.message));
    }
  };
  const allowedFields = task ? editableFields(task) : [];
  const canEditField = (field) => allowedFields === 'all' || allowedFields.includes(field);
  const handleDelete = async () => {
    if (!canDeleteTask) return;
    if (window.confirm("¿Seguro que quieres eliminar esta tarea de forma permanente?")) {
      try {
        await deleteTask(taskId);
        handleClose();
        // Here we'd ideally mutate the list/kanban board via a global SWR config or event
      } catch (err) {
        alert("Error al eliminar la tarea");
      }
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 50,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 200ms ease-out'
        }}
      />

      {/* Right Panel */}
      <div data-testid="task-modal" style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '480px',
        maxWidth: '100vw',
        backgroundColor: '#ffffff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
        zIndex: 51,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease-out',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {!task && !error ? (
          <div data-testid="task-modal" style={{ padding: '24px' }}>Cargando...</div>
        ) : (
          <>
            {/* Header */}
            <div data-testid="task-modal" style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <input 
                type="text" 
                value={title}
                readOnly={!canEditField('title')}
                onChange={e => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                style={{ 
                  fontSize: '20px', 
                  fontWeight: 600, 
                  color: '#0f172a', 
                  border: '1px solid transparent',
                  padding: '4px 8px',
                  marginLeft: '-8px',
                  borderRadius: '4px',
                  width: 'calc(100% - 32px)',
                  outline: 'none',
                  transition: 'border-color 0.2s, background-color 0.2s',
                  backgroundColor: !canEditField('title') ? 'transparent' : undefined
                }}
                onFocus={e => {
                  if (canEditField('title')) {
                    e.target.style.backgroundColor = '#f8fafc';
                    e.target.style.borderColor = '#cbd5e1';
                  }
                }}
              />
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div data-testid="task-modal" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              
              {/* Metadata Grid */}
              <div data-testid="task-modal" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', marginBottom: '32px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Estado</span>
                <select 
                  disabled={!canEditField('status')}
                  value={task?.status}
                  onChange={async e => {
                    const newStatus = e.target.value;
                    try {
                      await updateTask(taskId, { status: newStatus });
                      mutate({ ...task, status: newStatus }, false);
                    } catch (err) {}
                  }}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: !canEditField('status') ? '#f8fafc' : '#fff' }}
                >
                  <option value={task?.status}>{task?.status?.replace('_', ' ')}</option>
                  <option value="in_progress">in progress</option>
                  <option value="done">done</option>
                </select>

                <span style={{ color: '#64748b', fontSize: '13px' }}>Prioridad</span>
                <select 
                  value={task?.priority || 'medium'}
                  onChange={async e => {
                    const newPriority = e.target.value;
                    try {
                      await updateTask(taskId, { priority: newPriority });
                      mutate({ ...task, priority: newPriority }, false);
                    } catch (err) {}
                  }}
                  disabled={!canEditField('priority')}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: !canEditField('priority') ? '#f8fafc' : '#fff' }}
                >
                  <option value="critical">Crítica</option>
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>

                <span style={{ color: '#64748b', fontSize: '13px' }}>Asignado</span>
                <select 
                  value={task?.assignee_id || ''}
                  onChange={async e => {
                    const newAssignee = e.target.value ? Number(e.target.value) : null;
                    try {
                      await updateTask(taskId, { assignee_id: newAssignee });
                      mutate({ ...task, assignee_id: newAssignee }, false);
                    } catch (err) {}
                  }}
                  disabled={!canAssignTask}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: !canAssignTask ? '#f8fafc' : '#fff' }}
                >
                  <option value="">Sin asignar</option>
                  {members?.map(m => (
                    <option key={m.id} value={m.id}>
                      {getInitials(m.name)} {m.name} — {m.role}
                    </option>
                  ))}
                </select>

                <span style={{ color: '#64748b', fontSize: '13px' }}>Objetivo</span>
                <select 
                  value={task?.objective_id || ''}
                  onChange={async e => {
                    const newObjective = e.target.value ? Number(e.target.value) : null;
                    try {
                      await updateTask(taskId, { objective_id: newObjective });
                      mutate({ ...task, objective_id: newObjective }, false);
                    } catch (err) {}
                  }}
                  disabled={!canEditField('objective_id')}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: !canEditField('objective_id') ? '#f8fafc' : '#fff' }}
                >
                  <option value="">Sin objetivo</option>
                  {objectives?.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>

                <span style={{ color: '#64748b', fontSize: '13px' }}>Vencimiento</span>
                <input 
                  type="date" 
                  value={task?.due_date ? toDateInputValue(task.due_date) : ''}
                  onChange={async e => {
                    const newDate = e.target.value || null;
                    try {
                      await updateTask(taskId, { due_date: newDate });
                      mutate({ ...task, due_date: newDate }, false);
                    } catch (err) {}
                  }}
                  disabled={!canEditField('due_date')}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: !canEditField('due_date') ? '#f8fafc' : '#fff' }} 
                />
              </div>

              {/* Description */}
              <div data-testid="task-modal" style={{ marginBottom: '32px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Descripción</h4>
                <textarea 
                  value={description}
                  onChange={handleDescriptionChange}
                  readOnly={!canEditField('description')}
                  placeholder="Añade una descripción más detallada..."
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    color: '#334155',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    outline: 'none',
                    backgroundColor: !canEditField('description') ? '#f8fafc' : '#fff'
                  }}
                  onFocus={e => { if (canEditField('description')) e.target.style.borderColor = '#818cf8'} }
                  onBlur={e => { if (canEditField('description')) e.target.style.borderColor = '#e2e8f0'} }
                />
              </div>

              {/* Subtasks */}
              <div data-testid="task-modal" style={{ marginBottom: '32px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Subtareas</h4>
                <div data-testid="task-modal" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {subtasks?.map(st => (
                    <div key={st.id} data-testid="task-modal" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        checked={st.status === 'done'}
                        onChange={() => handleToggleSubtask(st)}
                        disabled={!canEditField('status')}
                      />
                      <span style={{ fontSize: '14px', color: '#334155', textDecoration: st.status === 'done' ? 'line-through' : 'none' }}>
                        {st.title}
                      </span>
                    </div>
                  ))}
                  {canEditField('title') && (
                    <form onSubmit={handleCreateSubtask} style={{ display: 'flex', marginTop: '4px' }}>
                      <input 
                        type="text" 
                        value={newSubtaskTitle}
                        onChange={e => setNewSubtaskTitle(e.target.value)}
                        placeholder="+ Añadir subtarea" 
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '13px', outline: 'none' }} 
                      />
                      <button type="submit" style={{ display: 'none' }}>Crear</button>
                    </form>
                  )}
                </div>
              </div>

              {/* Activities (Historial de Cambios) */}
              <div data-testid="task-modal" style={{ marginBottom: '32px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Historial de Actividades</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activities && activities.length > 0 ? (
                    activities.map(act => (
                      <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px' }}>
                        <div style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(act.created_at).toLocaleDateString()} {new Date(act.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <div style={{ color: '#334155' }}>
                          <strong style={{ color: '#0f172a' }}>{act.user_name || `U${act.user_id}`}</strong>{' '}
                          {act.from_status ? (
                            <>movió la tarea de <strong style={{ color: '#6366f1' }}>{act.from_status.replace('_', ' ')}</strong> a <strong style={{ color: '#6366f1' }}>{act.to_status.replace('_', ' ')}</strong></>
                          ) : (
                            <>creó la tarea en <strong style={{ color: '#6366f1' }}>{act.to_status.replace('_', ' ')}</strong></>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>No hay actividades registradas.</div>
                  )}
                </div>
              </div>

              {/* Time Logs */}
              {canLogTime && (
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Registro de Tiempo</h4>
                <div data-testid="task-modal" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input 
                    type="number" 
                    step="0.5"
                    min="0"
                    placeholder="Horas" 
                    value={newLogHours}
                    onChange={e => setNewLogHours(e.target.value)}
                    style={{ width: '80px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px' }} 
                  />
                  <input 
                    type="text" 
                    placeholder="¿En qué trabajaste?" 
                    value={newLogDesc}
                    onChange={e => setNewLogDesc(e.target.value)}
                    style={{ flex: 1, padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px' }} 
                  />
                  <button 
                    onClick={handleLogTime}
                    disabled={!newLogHours}
                    style={{ padding: '8px 16px', backgroundColor: newLogHours ? '#6366f1' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '4px', cursor: newLogHours ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 500 }}
                  >
                    Registrar
                  </button>
                </div>
                
                {/* Historial de logs */}
                {timeLogs && timeLogs.length > 0 ? (
                  <div data-testid="task-modal" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {timeLogs.slice(0, 5).map(log => (
                      <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '4px', fontSize: '12px' }}>
                        <span style={{ color: '#475569' }}>U{log.user_id} - {formatCalendarLocale(log.log_date)} {log.description && `(${log.description})`}</span>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{log.hours}h</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>No hay registros de tiempo aún.</span>
                )}
              </div>
              )}
            </div>

            {/* Footer */}
            {canDeleteTask && (
            <div data-testid="task-modal" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleDelete}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Eliminar tarea
              </button>
            </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default TaskModal;
