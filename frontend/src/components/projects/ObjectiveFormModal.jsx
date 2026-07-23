import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api/client';
import { resolveApiError } from '../../services/api/errors';
import { toDateInputValue } from '../../utils/dateUtils';
import { Modal, Input, Textarea, Button } from '../ui';

const LABEL = 'mb-1.5 block text-[13px] font-medium text-fg';

const getProgressColor = (percentage) => {
  if (percentage < 30) return '#f87171';
  if (percentage <= 70) return '#fb923c';
  return '#4ade80';
};

const ObjectiveFormModal = ({ projectId, objective, onClose, onSaved }) => {
  const { t } = useTranslation();
  const isEdit = !!objective;
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    project_id: projectId,
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setFormData({
        title: objective.title || '',
        description: objective.description || '',
        due_date: objective.due_date ? toDateInputValue(objective.due_date) : '',
        project_id: objective.project_id || projectId,
      });
    }
  }, [objective, isEdit, projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) return setError(t('objectives.form.errors.titleRequired'));
    if (!formData.due_date) return setError(t('objectives.form.errors.dueRequired'));

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/api/v1/objectives/${objective.id}`, formData);
      } else {
        await api.post('/api/v1/objectives', formData);
      }
      onSaved();
    } catch (err) {
      setError(resolveApiError(err, 'objectives.form.errors.save'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const derivedProgress = objective?.progress || 0;

  return (
    <Modal open onClose={onClose} className="max-w-lg p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-fg">
          {isEdit ? t('objectives.form.editTitle') : t('objectives.form.createTitle')}
        </h2>
        <button onClick={onClose} className="text-muted transition-colors hover:text-fg" aria-label={t('common.actions.close')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-[13px] text-status-blocked">{error}</div>
      )}

      <form id="objective-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className={LABEL}>{t('objectives.form.title.label')}</label>
          <Input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder={t('objectives.form.title.placeholder')}
          />
        </div>

        <div>
          <label className={LABEL}>{t('objectives.form.description.label')}</label>
          <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="min-h-20" />
        </div>

        {isEdit && (
          <div>
            <label className="mb-1.5 flex justify-between text-[13px] font-medium text-fg">
              <span>{t('objectives.form.progress.label')}</span>
              <span className="font-semibold" style={{ color: getProgressColor(derivedProgress) }}>{derivedProgress}%</span>
            </label>
            <div className="mt-1 h-2 w-full overflow-hidden rounded bg-border">
              <div className="h-full" style={{ width: `${derivedProgress}%`, backgroundColor: getProgressColor(derivedProgress) }} />
            </div>
          </div>
        )}

        <div>
          <label className={LABEL}>{t('objectives.form.dueDate.label')}</label>
          <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
        </div>
      </form>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="secondary" onClick={onClose}>{t('common.actions.cancel')}</Button>
        <Button type="submit" form="objective-form" disabled={isSubmitting}>
          {isSubmitting
            ? t('common.actions.saving')
            : isEdit
              ? t('objectives.form.save')
              : t('objectives.form.create')}
        </Button>
      </div>
    </Modal>
  );
};

export default ObjectiveFormModal;
