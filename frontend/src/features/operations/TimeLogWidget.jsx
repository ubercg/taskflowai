import { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../store/authStore';
import api from '../../services/api/client';
import { resolveApiError } from '../../services/api/errors';

const FIELD = 'w-full rounded-md border border-border bg-canvas px-2 py-2 text-[13px] text-fg outline-none focus:border-accent';
const LABEL = 'mb-1 block text-xs font-semibold text-muted';

const TimeLogWidget = ({ task, anchor, onClose, onLogged }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: logs } = useSWR(
    `/api/v1/time-logs?task_id=${task.id}`,
    () => api.get(`/api/v1/time-logs?task_id=${task.id}`).then((res) => res.data),
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const logsToday = logs ? logs.filter((l) => l.user_id === user.id && l.log_date === todayStr).reduce((acc, l) => acc + Number(l.hours), 0) : 0;

  const currentTotal = Number(task.logged_hours || 0);
  const newTotal = currentTotal + Number(hours || 0);
  const estimated = task.estimated_hours ? Number(task.estimated_hours) : null;
  const isOverEstimated = estimated !== null && newTotal > estimated;

  const handleSubmit = async () => {
    if (!hours || Number(hours) <= 0 || Number(hours) > 16) {
      return alert(t('myTasks.timeLog.hoursInvalid'));
    }

    setIsSubmitting(true);
    try {
      const newLog = await api.post('/api/v1/time-logs', {
        task_id: task.id,
        user_id: user.id,
        hours: Number(hours),
        description: description || null,
        log_date: date,
      }).then((res) => res.data);

      onLogged(newLog);
      onClose();
    } catch (err) {
      alert(resolveApiError(err, 'errors.UNKNOWN_ERROR'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed z-[999] flex w-80 flex-col rounded-lg border border-border bg-surface shadow-raised"
      style={{ top: anchor ? anchor.top : 0, right: anchor ? anchor.right : 24 }}
    >
      <div className="border-b border-border p-4">
        <h4 className="mb-1 text-[13px] font-medium text-muted">{t('myTasks.timeLog.title')}</h4>
        <div className="truncate text-sm font-semibold text-fg">{task.title}</div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={LABEL}>{t('myTasks.timeLog.hours')}</label>
            <input type="number" step="0.5" min="0.1" max="16" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0.0" className={FIELD} />
          </div>
          <div className="flex-1">
            <label className={LABEL}>{t('myTasks.timeLog.date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </div>
        </div>

        <div>
          <label className={LABEL}>{t('myTasks.timeLog.description')}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('myTasks.timeLog.descPlaceholder')}
            className={FIELD}
          />
        </div>

        {isOverEstimated && (
          <div className="flex items-center gap-1.5 rounded-md border border-priority-medium/40 bg-priority-medium/10 px-3 py-2 text-xs text-priority-medium">
            <span aria-hidden="true">⚠</span>
            <span>{t('myTasks.timeLog.overEstimate', { estimated })}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-b-lg border-t border-border bg-canvas px-4 py-3">
        <div className="text-[11px] text-muted">
          <span className="font-semibold text-fg">{t('myTasks.timeLog.today')}</span>{' '}
          {t('myTasks.loggedHours', { hours: logsToday })}
          <span className="mx-1.5" aria-hidden="true">|</span>
          <span className="font-semibold text-fg">{t('myTasks.timeLog.total')}</span>{' '}
          {estimated
            ? t('myTasks.timeLog.totalWithEst', { logged: currentTotal, estimated })
            : t('myTasks.loggedHours', { hours: currentTotal })}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-fg">
            {t('common.actions.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hours || isSubmitting}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t('myTasks.timeLog.submitting') : t('tasks.detail.timeLog.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeLogWidget;
