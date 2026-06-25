import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { getTasks, updateTask, moveTask } from '../../services/api';
import api from '../../services/api/client';
import usePermissions from '../../hooks/usePermissions';
import { Select, Button } from '../../components/ui';
import { cn } from '../../lib/cn';

// Punto de color por estado (clases estáticas para que Tailwind las detecte).
const STATUS_DOT = {
  backlog: 'bg-status-backlog',
  todo: 'bg-status-todo',
  in_progress: 'bg-status-in_progress',
  review: 'bg-status-review',
  blocked: 'bg-status-blocked',
  done: 'bg-status-done',
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const TaskListView = ({ projectId, onOpen }) => {
  const { canAssignTask, editableFields } = usePermissions();
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterPriority, setFilterPriority] = useState([]);
  const [filterObjective, setFilterObjective] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [massAssigneeId, setMassAssigneeId] = useState('');
  const [massPriority, setMassPriority] = useState('');
  const [isMassUpdating, setIsMassUpdating] = useState(false);
  const { data: tasks, error, isLoading, mutate } = useSWR(
    `/api/v1/tasks?project_id=${projectId}`,
    () => getTasks({ project_id: projectId }),
  );

  const { data: members } = useSWR(
    projectId ? `/api/v1/projects/${projectId}/members` : null,
    () => api.get(`/api/v1/projects/${projectId}/members`).then((res) => res.data),
  );

  const { data: objectives } = useSWR(
    projectId ? `/api/v1/objectives?project_id=${projectId}` : null,
    () => api.get(`/api/v1/objectives?project_id=${projectId}`).then((res) => res.data),
  );

  const togglePriorityFilter = (pri) => {
    setFilterPriority((prev) => (prev.includes(pri) ? prev.filter((p) => p !== pri) : [...prev, pri]));
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSelectAll = (filteredTaskIds) => {
    setSelectedIds((prev) => (prev.length === filteredTaskIds.length ? [] : filteredTaskIds));
  };

  const handleMassUpdate = async () => {
    if (selectedIds.length === 0) return;
    if (!massAssigneeId && !massPriority) return;

    setIsMassUpdating(true);
    try {
      const updates = {};
      if (massAssigneeId) {
        updates.assignee_id = massAssigneeId === 'unassigned' ? null : Number(massAssigneeId);
      }
      if (massPriority) {
        updates.priority = massPriority;
      }

      await Promise.all(selectedIds.map((id) => updateTask(id, updates)));
      mutate();
      setSelectedIds([]);
      setMassAssigneeId('');
      setMassPriority('');
    } catch (err) {
      alert('Error en actualización masiva: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsMassUpdating(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await moveTask(task.id, { status: newStatus, position: 0, user_id: 1 });
      mutate();
    } catch (err) {
      if (err.code === 'WIP_LIMIT_EXCEEDED') {
        alert(`WIP Limit alcanzado: ${err.response?.data?.detail?.current_wip}/3`);
      } else {
        alert('Error cambiando estado');
      }
      mutate();
    }
  };

  const handleAssigneeChange = async (task, newAssigneeId) => {
    const assigneeId = newAssigneeId ? Number(newAssigneeId) : null;
    try {
      mutate(tasks.map((t) => (t.id === task.id ? { ...t, assignee_id: assigneeId } : t)), false);
      await updateTask(task.id, { assignee_id: assigneeId });
      mutate();
    } catch (err) {
      alert('Error al asignar tarea');
      mutate();
    }
  };

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((task) => {
      if (filterAssignee !== 'all') {
        if (filterAssignee === 'unassigned' && task.assignee_id !== null) return false;
        if (filterAssignee !== 'unassigned' && task.assignee_id !== Number(filterAssignee)) return false;
      }
      if (filterPriority.length > 0 && !filterPriority.includes(task.priority)) return false;
      if (filterObjective !== 'all') {
        if (filterObjective === 'none' && task.objective_id !== null) return false;
        if (filterObjective !== 'none' && task.objective_id !== Number(filterObjective)) return false;
      }
      return true;
    });
  }, [tasks, filterAssignee, filterPriority, filterObjective]);

  const groupedTasks = useMemo(() => {
    if (!filteredTasks) return {};
    return filteredTasks.reduce((acc, task) => {
      const status = task.status || 'backlog';
      if (!acc[status]) acc[status] = [];
      acc[status].push(task);
      return acc;
    }, {});
  }, [filteredTasks]);

  if (isLoading) return <div className="text-muted">Cargando lista de tareas...</div>;
  if (error) return <div className="text-status-blocked">Error cargando tareas.</div>;

  const STATUS_ORDER = ['in_progress', 'blocked', 'review', 'todo', 'backlog', 'done'];
  const filterSelect = 'rounded-md border border-border bg-canvas px-3 py-1.5 text-[13px] text-fg outline-none focus:border-accent';

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      {/* Filtros */}
      <div className="flex items-center gap-4 border-b border-border bg-canvas p-4">
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className={filterSelect}>
          <option value="all">Cualquier Asignado</option>
          <option value="unassigned">Sin asignar</option>
          {members?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <select value={filterObjective} onChange={(e) => setFilterObjective(e.target.value)} className={filterSelect}>
          <option value="all">Cualquier OKR</option>
          <option value="none">Sin OKR</option>
          {objectives?.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>

        <div className="flex gap-1.5">
          {['critical', 'high', 'medium', 'low'].map((p) => (
            <button
              key={p}
              onClick={() => togglePriorityFilter(p)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors',
                filterPriority.includes(p)
                  ? 'border-2 border-accent bg-accent-soft text-accent'
                  : 'border border-border bg-surface text-muted hover:text-fg',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Grid agrupado por estado */}
      <div className="flex-1 overflow-y-auto">
        {STATUS_ORDER.map((status) => {
          const groupTasks = groupedTasks[status];
          if (!groupTasks || groupTasks.length === 0) return null;

          return (
            <div key={status}>
              {/* Header de sección */}
              <div className="flex items-center gap-2 border-b border-border bg-raised px-4 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && groupTasks.every((t) => selectedIds.includes(t.id))}
                  onChange={() => handleSelectAll(groupTasks.map((t) => t.id))}
                  className="cursor-pointer accent-[var(--color-accent)]"
                />
                <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />
                <h4 className="text-[13px] font-semibold uppercase text-fg">{status.replace('_', ' ')}</h4>
                <span className="text-xs font-medium text-muted">({groupTasks.length})</span>
              </div>

              {/* Tabla */}
              <table className="w-full border-collapse text-left">
                <tbody>
                  {groupTasks.map((task) => {
                    const assignee = members?.find((m) => m.id === task.assignee_id);
                    const objective = objectives?.find((o) => o.id === task.objective_id);
                    const canEditField = (field) => {
                      const allowedFields = editableFields(task);
                      return allowedFields === 'all' || allowedFields.includes(field);
                    };

                    return (
                      <tr key={task.id} className="border-b border-hairline transition-colors hover:bg-raised">
                        <td className="w-[4%] px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(task.id)}
                            onChange={() => handleToggleSelect(task.id)}
                            className="cursor-pointer accent-[var(--color-accent)]"
                          />
                        </td>
                        <td className="w-[30%] cursor-pointer px-4 py-3" onClick={() => onOpen(task.id)}>
                          <div className="text-sm font-medium text-fg">{task.title}</div>
                        </td>
                        <td className="w-[12%] px-4 py-3">
                          <span className="rounded-full border border-border bg-canvas px-2 py-0.5 text-xs capitalize text-muted">
                            {task.priority || 'medium'}
                          </span>
                        </td>
                        <td className="w-[16%] px-4 py-3">
                          {objective ? (
                            <span className="rounded-full bg-status-review/15 px-1.5 py-0.5 text-[11px] font-semibold text-status-review">
                              🎯 {objective.title.length > 20 ? objective.title.substring(0, 20) + '...' : objective.title}
                            </span>
                          ) : (
                            <span className="text-[11px] text-faint">Sin OKR</span>
                          )}
                        </td>
                        <td className="w-[15%] px-4 py-3">
                          <select
                            disabled={!canAssignTask}
                            value={task.assignee_id || 'unassigned'}
                            onChange={(e) => handleAssigneeChange(task, e.target.value)}
                            className="rounded-md border border-border px-1 py-1 text-[13px] text-fg outline-none disabled:cursor-not-allowed"
                            style={{ backgroundColor: assignee ? assignee.color + '20' : 'var(--color-canvas)' }}
                          >
                            <option value="unassigned">— Sin asignar</option>
                            {members?.map((m) => (
                              <option key={m.id} value={m.id}>{getInitials(m.name)} {m.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="w-[15%] px-4 py-3">
                          <select
                            disabled={!canEditField('status')}
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            className="rounded-md border border-border bg-canvas px-2 py-1 text-[13px] text-fg outline-none disabled:cursor-not-allowed"
                          >
                            <option value="backlog">Backlog</option>
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                        </td>
                        <td className="w-[10%] px-4 py-3 text-right">
                          <span className="text-[13px] font-medium text-muted">
                            {task.logged_hours || 0}h / {task.estimated_hours || '-'}h
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Barra de acciones masivas */}
      {selectedIds.length > 0 && (
        <div
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-6 rounded-xl border border-border bg-raised px-6 py-4 shadow-overlay"
          style={{ animation: 'slideUp 0.2s ease-out' }}
        >
          <span className="text-sm font-semibold text-fg">{selectedIds.length} tareas seleccionadas</span>

          <div className="flex items-center gap-3">
            <Select value={massAssigneeId} onChange={(e) => setMassAssigneeId(e.target.value)} className="w-auto py-1.5">
              <option value="">Asignar a…</option>
              <option value="unassigned">Desasignar</option>
              {members?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>

            <Select value={massPriority} onChange={(e) => setMassPriority(e.target.value)} className="w-auto py-1.5">
              <option value="">Cambiar prioridad…</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </Select>

            <Button onClick={handleMassUpdate} disabled={isMassUpdating || (!massAssigneeId && !massPriority)} size="sm">
              {isMassUpdating ? 'Actualizando...' : 'Aplicar'}
            </Button>

            <button
              onClick={() => { setSelectedIds([]); setMassAssigneeId(''); setMassPriority(''); }}
              className="text-[13px] text-faint hover:text-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default TaskListView;
