import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { getTask, getTasks, updateTask, deleteTask, getTimeLogs, createTimeLog } from '../../services/api';
import api from '../../services/api/client';
import { toDateInputValue, formatCalendarLocale } from '../../utils/dateUtils';
import Linkify from '../../components/shared/Linkify';
import usePermissions from '../../hooks/usePermissions';
import { useAuth } from '../../store/authStore';
import { cn } from '../../lib/cn';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const FIELD =
  'rounded border border-border bg-canvas px-2 py-1 text-[13px] text-fg outline-none ' +
  'transition-colors focus:border-accent disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted';
const META_LABEL = 'text-[13px] text-muted';
const SECTION_TITLE = 'mb-3 text-sm font-semibold text-fg';

const TaskModal = ({ taskId, onClose }) => {
  const { canAssignTask, canDeleteTask, canLogTime, editableFields } = usePermissions();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [newLogHours, setNewLogHours] = useState('');
  const [newLogDesc, setNewLogDesc] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const saveTimeoutRef = useRef(null);

  const { data: task, error, mutate } = useSWR(
    taskId ? `/api/v1/tasks/${taskId}` : null,
    () => getTask(taskId),
    { revalidateOnFocus: false },
  );

  const { data: timeLogs, mutate: mutateLogs } = useSWR(
    taskId ? `/api/v1/time-logs?task_id=${taskId}` : null,
    () => getTimeLogs({ task_id: taskId }),
  );

  const { data: activities } = useSWR(
    taskId ? `/api/v1/tasks/${taskId}/activities` : null,
    () => api.get(`/api/v1/tasks/${taskId}/activities`).then((res) => res.data),
  );

  const { data: subtasks, mutate: mutateSubtasks } = useSWR(
    task?.project_id != null && taskId != null
      ? `/api/v1/tasks?project_id=${task.project_id}&parent_id=${taskId}`
      : null,
    () => getTasks({ project_id: task.project_id, parent_id: taskId }),
  );

  const { data: members } = useSWR(
    task?.project_id ? `/api/v1/projects/${task.project_id}/members` : null,
    () => api.get(`/api/v1/projects/${task.project_id}/members`).then((res) => res.data),
  );

  const { data: objectives } = useSWR(
    task?.project_id ? `/api/v1/objectives?project_id=${task.project_id}` : null,
    () => api.get(`/api/v1/objectives?project_id=${task.project_id}`).then((res) => res.data),
  );

  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true));
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setEstimatedHours(task.estimated_hours ?? '');
    }
  }, [task]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200);
  };

  const handleEstimatedHoursBlur = async () => {
    const parsed = estimatedHours === '' ? null : parseFloat(estimatedHours);
    if (parsed === task?.estimated_hours) return;
    try {
      await updateTask(taskId, { estimated_hours: parsed });
      mutate({ ...task, estimated_hours: parsed }, false);
    } catch {
      setEstimatedHours(task?.estimated_hours ?? '');
    }
  };

  const handleTitleBlur = async () => {
    if (title !== task?.title) {
      try {
        await updateTask(taskId, { title });
        mutate({ ...task, title }, false);
      } catch (err) {
        console.error('Error updating title', err);
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
        console.error('Error auto-saving description', err);
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
        status: 'backlog',
      });
      setNewSubtaskTitle('');
      mutateSubtasks();
    } catch (err) {
      alert('Error al crear subtarea: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggleSubtask = async (subtask) => {
    const newStatus = subtask.status === 'done' ? 'backlog' : 'done';
    try {
      await api.patch(`/api/v1/tasks/${subtask.id}`, { status: newStatus });
      mutateSubtasks();
    } catch (err) {
      alert('Error al actualizar subtarea: ' + (err.response?.data?.detail || err.message));
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
        log_date: new Date().toISOString().split('T')[0],
      });
      setNewLogHours('');
      setNewLogDesc('');
      mutateLogs();
      mutate();
    } catch (err) {
      alert('Error al registrar tiempo: ' + (err.detail || err.message));
    }
  };

  const allowedFields = task ? editableFields(task) : [];
  const canEditField = (field) => allowedFields === 'all' || allowedFields.includes(field);

  const handleDelete = async () => {
    if (!canDeleteTask) return;
    if (window.confirm('¿Seguro que quieres eliminar esta tarea de forma permanente?')) {
      try {
        await deleteTask(taskId);
        handleClose();
      } catch {
        alert('Error al eliminar la tarea');
      }
    }
  };

  return createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: isOpen ? 1 : 0 }}
      />

      {/* Panel derecho */}
      <div
        data-testid="task-modal"
        className="fixed inset-y-0 right-0 z-[51] flex w-[480px] max-w-full flex-col border-l border-border bg-surface shadow-overlay transition-transform duration-200"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {!task && !error ? (
          <div className="p-6 text-muted">Cargando...</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <input
                type="text"
                value={title}
                readOnly={!canEditField('title')}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="-ml-2 w-[calc(100%-32px)] rounded border border-transparent px-2 py-1 text-xl font-semibold text-fg outline-none transition-colors read-only:cursor-default focus:border-border focus:bg-canvas"
              />
              <button onClick={handleClose} className="text-muted transition-colors hover:text-fg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Metadata */}
              <div className="mb-8 grid grid-cols-[120px_1fr] items-center gap-4">
                <span className={META_LABEL}>Estado</span>
                <select
                  disabled={!canEditField('status')}
                  value={task?.status}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    try {
                      await updateTask(taskId, { status: newStatus });
                      mutate({ ...task, status: newStatus }, false);
                    } catch {}
                  }}
                  className={FIELD}
                >
                  <option value={task?.status}>{task?.status?.replace('_', ' ')}</option>
                  <option value="in_progress">in progress</option>
                  <option value="done">done</option>
                </select>

                <span className={META_LABEL}>Prioridad</span>
                <select
                  value={task?.priority || 'medium'}
                  onChange={async (e) => {
                    const newPriority = e.target.value;
                    try {
                      await updateTask(taskId, { priority: newPriority });
                      mutate({ ...task, priority: newPriority }, false);
                    } catch {}
                  }}
                  disabled={!canEditField('priority')}
                  className={FIELD}
                >
                  <option value="critical">Crítica</option>
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>

                <span className={META_LABEL}>Asignado</span>
                <select
                  value={task?.assignee_id || ''}
                  onChange={async (e) => {
                    const newAssignee = e.target.value ? Number(e.target.value) : null;
                    try {
                      await updateTask(taskId, { assignee_id: newAssignee });
                      mutate({ ...task, assignee_id: newAssignee }, false);
                    } catch {}
                  }}
                  disabled={!canAssignTask}
                  className={FIELD}
                >
                  <option value="">Sin asignar</option>
                  {members?.map((m) => (
                    <option key={m.id} value={m.id}>{getInitials(m.name)} {m.name} — {m.role}</option>
                  ))}
                </select>

                <span className={META_LABEL}>Objetivo</span>
                <select
                  value={task?.objective_id || ''}
                  onChange={async (e) => {
                    const newObjective = e.target.value ? Number(e.target.value) : null;
                    try {
                      await updateTask(taskId, { objective_id: newObjective });
                      mutate({ ...task, objective_id: newObjective }, false);
                    } catch {}
                  }}
                  disabled={!canEditField('objective_id')}
                  className={FIELD}
                >
                  <option value="">Sin objetivo</option>
                  {objectives?.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select>

                <span className={META_LABEL}>Vencimiento</span>
                <input
                  type="date"
                  value={task?.due_date ? toDateInputValue(task.due_date) : ''}
                  onChange={async (e) => {
                    const newDate = e.target.value || null;
                    try {
                      await updateTask(taskId, { due_date: newDate });
                      mutate({ ...task, due_date: newDate }, false);
                    } catch {}
                  }}
                  disabled={!canEditField('due_date')}
                  className={FIELD}
                />

                <span className={META_LABEL}>Estimación (hs)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  onBlur={handleEstimatedHoursBlur}
                  disabled={!canEditField('estimated_hours')}
                  placeholder="0.0"
                  className={cn(FIELD, 'w-[100px]')}
                />
              </div>

              {/* Descripción */}
              <div className="mb-8">
                <h4 className={SECTION_TITLE}>Descripción</h4>

                {!canEditField('description') && (
                  <div className={cn('min-h-[120px] whitespace-pre-wrap break-words rounded-md border border-border bg-canvas p-3 text-sm', description ? 'text-fg' : 'text-faint')}>
                    {description ? <Linkify text={description} /> : 'Sin descripción.'}
                  </div>
                )}

                {canEditField('description') && !editingDesc && (
                  <div
                    onClick={() => setEditingDesc(true)}
                    className={cn('min-h-[120px] cursor-pointer whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 text-sm transition-colors hover:border-accent', description ? 'text-fg' : 'text-faint')}
                  >
                    {description ? <Linkify text={description} /> : 'Añade una descripción más detallada...'}
                  </div>
                )}

                {canEditField('description') && editingDesc && (
                  <textarea
                    autoFocus
                    value={description}
                    onChange={handleDescriptionChange}
                    placeholder="Añade una descripción más detallada..."
                    onBlur={() => setEditingDesc(false)}
                    className="min-h-[120px] w-full resize-y rounded-md border border-accent bg-surface p-3 text-sm text-fg outline-none"
                  />
                )}
              </div>

              {/* Subtareas */}
              <div className="mb-8">
                <h4 className={SECTION_TITLE}>Subtareas</h4>
                <div className="flex flex-col gap-2">
                  {subtasks?.map((st) => (
                    <div key={st.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={st.status === 'done'}
                        onChange={() => handleToggleSubtask(st)}
                        disabled={!canEditField('status')}
                        className="accent-[var(--color-accent)]"
                      />
                      <span className={cn('text-sm', st.status === 'done' ? 'text-faint line-through' : 'text-fg')}>
                        {st.title}
                      </span>
                    </div>
                  ))}
                  {canEditField('title') && (
                    <form onSubmit={handleCreateSubtask} className="mt-1 flex">
                      <input
                        type="text"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="+ Añadir subtarea"
                        className="flex-1 rounded-md border border-dashed border-border bg-transparent px-3 py-2 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
                      />
                      <button type="submit" className="hidden">Crear</button>
                    </form>
                  )}
                </div>
              </div>

              {/* Historial de actividades */}
              <div className="mb-8">
                <h4 className={SECTION_TITLE}>Historial de Actividades</h4>
                <div className="flex flex-col gap-2">
                  {activities && activities.length > 0 ? (
                    activities.map((act) => (
                      <div key={act.id} className="flex items-start gap-2 text-xs">
                        <div className="whitespace-nowrap text-muted">
                          {new Date(act.created_at).toLocaleDateString()} {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-fg">
                          <strong className="text-fg">{act.user_name || `U${act.user_id}`}</strong>{' '}
                          {act.from_status ? (
                            <>movió la tarea de <strong className="text-accent">{act.from_status.replace('_', ' ')}</strong> a <strong className="text-accent">{act.to_status.replace('_', ' ')}</strong></>
                          ) : (
                            <>creó la tarea en <strong className="text-accent">{act.to_status.replace('_', ' ')}</strong></>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-faint">No hay actividades registradas.</div>
                  )}
                </div>
              </div>

              {/* Registro de tiempo */}
              {canLogTime && (
                <div>
                  <h4 className={SECTION_TITLE}>Registro de Tiempo</h4>
                  <div className="mb-4 flex gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="Horas"
                      value={newLogHours}
                      onChange={(e) => setNewLogHours(e.target.value)}
                      className={cn(FIELD, 'w-20 py-2')}
                    />
                    <input
                      type="text"
                      placeholder="¿En qué trabajaste?"
                      value={newLogDesc}
                      onChange={(e) => setNewLogDesc(e.target.value)}
                      className={cn(FIELD, 'flex-1 py-2')}
                    />
                    <button
                      onClick={handleLogTime}
                      disabled={!newLogHours}
                      className="rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Registrar
                    </button>
                  </div>

                  {timeLogs && timeLogs.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {timeLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex justify-between rounded bg-raised px-3 py-2 text-xs">
                          <span className="text-muted">
                            U{log.user_id} - {formatCalendarLocale(log.log_date)}
                            {log.description && <> (<Linkify text={log.description} />)</>}
                          </span>
                          <span className="font-semibold text-fg">{log.hours}h</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-faint">No hay registros de tiempo aún.</span>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {canDeleteTask && (
              <div className="flex justify-end border-t border-border bg-canvas px-6 py-4">
                <button
                  onClick={handleDelete}
                  className="rounded-md border border-status-blocked/40 bg-status-blocked/10 px-4 py-2 text-[13px] font-medium text-status-blocked transition-colors hover:bg-status-blocked/20"
                >
                  Eliminar tarea
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>,
    document.body,
  );
};

export default TaskModal;
