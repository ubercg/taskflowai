import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { createTask, updateTask } from '../../services/api';
import api from '../../services/api/client';
import { Link } from 'react-router-dom';
import { taskStatusLabel } from '../../i18n/enums';
import { cn } from '../../lib/cn';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const ObjectiveTasksPanel = ({ objective, projectId, onClose }) => {
  const { t } = useTranslation();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: tasks, mutate } = useSWR(
    `/api/v1/tasks?project_id=${projectId}&objective_id=${objective.id}`,
    () => api.get(`/api/v1/tasks?project_id=${projectId}`).then((res) => res.data.filter((task) => task.objective_id === objective.id)),
  );

  const { data: members } = useSWR(
    `/api/v1/projects/${projectId}/members`,
    () => api.get(`/api/v1/projects/${projectId}/members`).then((res) => res.data),
  );

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await createTask({
        project_id: Number(projectId),
        objective_id: objective.id,
        title: newTaskTitle,
        status: 'backlog',
        type: 'task',
      });
      setNewTaskTitle('');
      mutate();
    } catch (err) {
      const detail = (typeof err.detail === 'string' && err.detail) || err.response?.data?.detail?.detail || err.message || '';
      alert(t('objectives.tasks.createError', { detail }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssigneeChange = async (taskId, newAssigneeId) => {
    const assigneeId = newAssigneeId ? Number(newAssigneeId) : null;
    try {
      mutate(tasks.map((task) => (task.id === taskId ? { ...task, assignee_id: assigneeId } : task)), false);
      await updateTask(taskId, { assignee_id: assigneeId });
      mutate();
    } catch (err) {
      alert(t('objectives.tasks.assignError'));
      mutate();
    }
  };

  const doneTasks = tasks ? tasks.filter((task) => task.status === 'done').length : 0;
  const totalTasks = tasks ? tasks.length : 0;

  return (
    <div className="flex flex-col gap-5 border-t border-border bg-canvas p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <span className="text-accent" aria-hidden="true">↳</span> {t('objectives.tasks.title')}
          </h3>
          <p className="mt-1 text-[13px] text-muted">
            {totalTasks > 0
              ? t('objectives.tasks.completedOfTotal', { done: doneTasks, total: totalTasks })
              : t('objectives.tasks.emptyYet')}
          </p>
        </div>
        <button onClick={onClose} className="text-[13px] text-muted transition-colors hover:text-fg">
          <span aria-hidden="true">✕ </span>{t('objectives.tasks.closePanel')}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {!tasks ? (
          <div className="text-[13px] text-faint">{t('objectives.tasks.loading')}</div>
        ) : tasks.length === 0 ? (
          <div className="text-[13px] italic text-faint">{t('objectives.tasks.empty')}</div>
        ) : (
          tasks.map((task) => {
            const isDone = task.status === 'done';
            const assignee = members?.find((m) => m.id === task.assignee_id);

            return (
              <div
                key={task.id}
                className={cn('flex items-center justify-between rounded-lg border border-border bg-surface p-3', isDone && 'opacity-70')}
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] font-semibold capitalize text-muted">
                    {taskStatusLabel(task.status)}
                  </span>
                  <span className={cn('text-sm font-medium text-fg', isDone && 'line-through')}>{task.title}</span>
                </div>

                <select
                  value={task.assignee_id || 'unassigned'}
                  onChange={(e) => handleAssigneeChange(task.id, e.target.value)}
                  className="cursor-pointer rounded-md border border-border px-1 py-1 text-xs text-fg outline-none"
                  style={{ backgroundColor: assignee ? assignee.color + '20' : 'var(--color-canvas)' }}
                >
                  <option value="unassigned">{t('objectives.tasks.unassigned')}</option>
                  {members?.map((m) => (
                    <option key={m.id} value={m.id}>{getInitials(m.name)} {m.name}</option>
                  ))}
                </select>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleCreateTask} className="flex gap-2">
        <input
          type="text"
          placeholder={t('objectives.tasks.newPlaceholder')}
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          className="flex-1 rounded-md border border-dashed border-border bg-surface px-3 py-2.5 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
        />
        <button
          type="submit"
          disabled={!newTaskTitle.trim() || isSubmitting}
          className="rounded-md border border-accent/40 bg-surface px-4 py-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t('objectives.tasks.adding') : t('objectives.tasks.add')}
        </button>
      </form>

      <div className="mt-2 flex justify-end">
        <Link to={`/projects/${projectId}/board?objective=${objective.id}`} className="text-[13px] font-medium text-accent hover:text-accent-hover">
          {t('objectives.tasks.viewOnBoard')}
        </Link>
      </div>
    </div>
  );
};

export default ObjectiveTasksPanel;
