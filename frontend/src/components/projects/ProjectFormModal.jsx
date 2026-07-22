import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api/client';
import { toDateInputValue } from '../../utils/dateUtils';
import { projectStatusLabel } from '../../i18n/enums';
import { Modal, Input, Textarea, Select, Button } from '../ui';
import { cn } from '../../lib/cn';

const EMOJIS = ['🚀', '🏛️', '🤖', '⚡', '🎯', '💡', '🔧', '📦'];
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
const STATUS_OPTIONS = ['active', 'on_hold', 'completed', 'archived'];

const LABEL = 'mb-1.5 block text-[13px] font-medium text-fg';

const ProjectFormModal = ({ project, onClose, onSaved }) => {
  const { t } = useTranslation();
  const isEdit = !!project;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: EMOJIS[0],
    color: COLORS[0],
    start_date: '',
    end_date: '',
    status: 'active',
  });
  const [error, setError] = useState(null);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        icon: project.icon || EMOJIS[0],
        color: project.color || COLORS[0],
        start_date: project.start_date ? toDateInputValue(project.start_date) : '',
        end_date: project.end_date ? toDateInputValue(project.end_date) : '',
        status: project.status || 'active',
      });
    }
  }, [project, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNameInvalid(false);

    if (!formData.name.trim()) {
      setNameInvalid(true);
      return setError(t('projects.form.errors.nameRequired'));
    }
    if (formData.start_date && formData.end_date && new Date(formData.end_date) < new Date(formData.start_date)) {
      return setError(t('projects.form.errors.endBeforeStart'));
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description,
      icon: formData.icon,
      color: formData.color,
      status: formData.status,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    };

    setIsSubmitting(true);
    try {
      const res = isEdit
        ? await api.patch(`/api/v1/projects/${project.id}`, payload)
        : await api.post('/api/v1/projects', payload);
      onSaved(res.data);
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = (typeof err.detail === 'string' && err.detail)
        || (typeof d === 'string' ? d : Array.isArray(d) ? d.map((e) => e.msg || JSON.stringify(e)).join(' ') : d?.detail ? d.detail : err.message);
      setError(msg || t('projects.form.errors.save'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="flex max-w-xl flex-col p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-fg">
          {isEdit ? t('projects.form.editTitle') : t('projects.form.createTitle')}
        </h2>
        <button onClick={onClose} className="text-muted transition-colors hover:text-fg" aria-label={t('common.actions.close')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div className="mb-6 flex items-center gap-4 rounded-lg border border-border bg-canvas p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl" style={{ backgroundColor: formData.color }}>
          {formData.icon}
        </div>
        <div>
          <div className="mb-0.5 text-xs font-semibold uppercase text-muted">{t('projects.form.preview')}</div>
          <div className="text-base font-semibold text-fg">{formData.name || t('projects.form.namePlaceholderPreview')}</div>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-[13px] text-status-blocked">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto pr-2">
        <form id="project-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className={LABEL}>{t('projects.form.name.label')}</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn(nameInvalid && 'border-status-blocked')}
              placeholder={t('projects.form.name.placeholder')}
            />
          </div>

          <div>
            <label className="mb-1.5 flex justify-between text-[13px] font-medium text-fg">
              <span>{t('projects.form.description.label')}</span>
              <span className="text-faint">{formData.description.length}/300</span>
            </label>
            <Textarea
              maxLength={300}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-20"
              placeholder={t('projects.form.description.placeholder')}
            />
          </div>

          <div>
            <label className={LABEL}>{t('projects.form.icon.label')}</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((emoji) => (
                <div
                  key={emoji}
                  onClick={() => setFormData({ ...formData, icon: emoji })}
                  className={cn(
                    'flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-2 text-xl transition-all',
                    formData.icon === emoji ? 'border-accent bg-accent-soft' : 'border-transparent bg-raised',
                  )}
                >
                  {emoji}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL}>{t('projects.form.color.label')}</label>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => setFormData({ ...formData, color: c })}
                  className={cn(
                    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-all',
                    formData.color === c ? 'border-fg' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                >
                  {formData.color === c && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className={LABEL}>{t('projects.form.startDate.label')}</label>
              <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className={LABEL}>{t('projects.form.endDate.label')}</label>
              <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className={LABEL}>{t('projects.form.status.label')}</label>
              <Select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{projectStatusLabel(status)}</option>
                ))}
              </Select>
            </div>
          )}
        </form>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="secondary" onClick={onClose}>{t('common.actions.cancel')}</Button>
        <Button type="submit" form="project-form" disabled={isSubmitting}>
          {isSubmitting
            ? t('projects.form.saving')
            : isEdit
              ? t('projects.form.saveChanges')
              : t('projects.form.create')}
        </Button>
      </div>
    </Modal>
  );
};

export default ProjectFormModal;
