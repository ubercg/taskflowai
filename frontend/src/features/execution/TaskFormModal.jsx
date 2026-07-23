import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { createTask } from '../../services/api';
import api from '../../services/api/client';
import { resolveApiError } from '../../services/api/errors';
import { useAuth } from '../../store/authStore';
import { taskPriorityLabel } from '../../i18n/enums';
import { Modal, Input, Select, Textarea, Button } from '../../components/ui';
import { cn } from '../../lib/cn';

const PRIORITIES = [
  { id: 'critical', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
  { id: 'high', color: '#f97316', bg: '#fff7ed', border: '#fdba74' },
  { id: 'medium', color: '#eab308', bg: '#fefce8', border: '#fde047' },
  { id: 'low', color: '#22c55e', bg: '#f0fdf4', border: '#86efac' },
];

const LABEL = 'mb-2 block text-xs font-semibold uppercase text-muted';

const TaskFormModal = ({ projectId, defaultStatus = 'backlog', defaultObjectiveId = null, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignee_id: '',
    objective_id: defaultObjectiveId || '',
    due_date: '',
    estimated_hours: '',
    status: defaultStatus,
    type: 'task',
    project_id: projectId,
  });

  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [error, setError] = useState(null);
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [wipWarning, setWipWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: members } = useSWR(
    projectId ? `/api/v1/projects/${projectId}/members` : null,
    () => api.get(`/api/v1/projects/${projectId}/members`).then((res) => res.data),
  );

  const { data: objectives } = useSWR(
    projectId ? `/api/v1/objectives?project_id=${projectId}` : null,
    () => api.get(`/api/v1/objectives?project_id=${projectId}`).then((res) => res.data),
  );

  const { data: velocities } = useSWR(
    '/api/v1/metrics/velocity',
    () => api.get('/api/v1/metrics/velocity').then((res) => res.data),
    { shouldRetryOnError: false },
  );

  useEffect(() => {
    if (formData.status === 'in_progress' && formData.assignee_id && velocities) {
      const userVelocity = velocities.find((v) => v.user_id === Number(formData.assignee_id));
      setWipWarning(!!(userVelocity && userVelocity.in_progress >= 3));
    } else {
      setWipWarning(false);
    }
  }, [formData.assignee_id, formData.status, velocities]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setTitleInvalid(false);

    if (!formData.title.trim()) {
      setTitleInvalid(true);
      return setError(t('tasks.form.errors.titleRequired'));
    }

    const payload = {
      ...formData,
      assignee_id: formData.assignee_id ? Number(formData.assignee_id) : null,
      objective_id: formData.objective_id ? Number(formData.objective_id) : null,
      estimated_hours: formData.estimated_hours ? Number(formData.estimated_hours) : null,
      due_date: formData.due_date || null,
    };

    setIsSubmitting(true);
    try {
      const newTask = await createTask(payload);
      onCreated(newTask);
    } catch (err) {
      setError(resolveApiError(err, 'tasks.form.errors.create'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="flex max-w-xl flex-col p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-fg">{t('tasks.form.createTitle')}</h2>
        <button onClick={onClose} className="text-muted transition-colors hover:text-fg" aria-label={t('common.actions.close')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-[13px] text-status-blocked">
          {error}
        </div>
      )}

      {wipWarning && (
        <div className="mb-5 rounded-md border border-priority-high/40 bg-priority-high/10 p-3 text-[13px] text-priority-high">
          <span aria-hidden="true">⚠️</span> {t('tasks.form.wipWarning')}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-2">
        <form id="task-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            autoFocus
            className={cn('py-3 text-base font-medium', titleInvalid && 'border-status-blocked')}
            placeholder={t('tasks.form.title.placeholder')}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>{t('tasks.form.assignee.label')}</label>
              <Select
                value={formData.assignee_id}
                onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
              >
                <option value="">{t('tasks.form.assignee.unassigned')}</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className={LABEL}>{t('tasks.form.objective.label')}</label>
              <Select
                value={formData.objective_id}
                onChange={(e) => setFormData({ ...formData, objective_id: e.target.value })}
              >
                <option value="">{t('tasks.form.objective.none')}</option>
                {objectives?.map((o) => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className={LABEL}>{t('tasks.form.priority.label')}</label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => {
                const selected = formData.priority === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p.id })}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all',
                      !selected && 'border-border bg-canvas text-muted hover:text-fg',
                    )}
                    style={selected ? { borderColor: p.border, backgroundColor: p.bg, color: p.color } : undefined}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {taskPriorityLabel(p.id)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>{t('tasks.form.dueDate.label')}</label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div>
              <label className={LABEL}>{t('tasks.form.estimatedHours.label')}</label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                placeholder="0.0"
              />
            </div>
          </div>

          <div>
            {!isDescExpanded ? (
              <button
                type="button"
                onClick={() => setIsDescExpanded(true)}
                className="text-[13px] font-medium text-accent hover:text-accent-hover"
              >
                {t('tasks.form.addDescription')}
              </button>
            ) : (
              <>
                <label className={LABEL}>{t('tasks.form.description.label')}</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-20"
                  placeholder={t('tasks.form.description.placeholder')}
                />
              </>
            )}
          </div>
        </form>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="secondary" onClick={onClose}>{t('common.actions.cancel')}</Button>
        <Button type="submit" form="task-form" disabled={isSubmitting}>
          {isSubmitting ? t('tasks.form.creating') : t('tasks.form.create')}
        </Button>
      </div>
    </Modal>
  );
};

export default TaskFormModal;
