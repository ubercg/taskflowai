import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../store/authStore';
import api from '../../services/api/client';

const FIELD = 'w-full rounded-md border border-border bg-canvas px-2 py-2 text-[13px] text-fg outline-none focus:border-accent';
const LABEL = 'mb-1 block text-xs font-semibold text-muted';

const TimeLogWidget = ({ task, anchor, onClose, onLogged }) => {
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
      return alert('Las horas deben ser mayores a 0 y máximo 16');
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
      alert('Error al registrar tiempo: ' + (err.response?.data?.detail || err.message));
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
        <h4 className="mb-1 text-[13px] font-medium text-muted">Registrar tiempo en:</h4>
        <div className="truncate text-sm font-semibold text-fg">{task.title}</div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={LABEL}>Horas</label>
            <input type="number" step="0.5" min="0.1" max="16" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0.0" className={FIELD} />
          </div>
          <div className="flex-1">
            <label className={LABEL}>Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </div>
        </div>

        <div>
          <label className={LABEL}>Descripción</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Actividad realizada..." className={FIELD} />
        </div>

        {isOverEstimated && (
          <div className="flex items-center gap-1.5 rounded-md border border-priority-medium/40 bg-priority-medium/10 px-3 py-2 text-xs text-priority-medium">
            <span>⚠</span>
            <span>Superarás las horas estimadas ({estimated}h)</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-b-lg border-t border-border bg-canvas px-4 py-3">
        <div className="text-[11px] text-muted">
          <span className="font-semibold text-fg">Hoy:</span> {logsToday}h
          <span className="mx-1.5">|</span>
          <span className="font-semibold text-fg">Total:</span> {currentTotal}h {estimated ? `/ ${estimated}h est.` : ''}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-fg">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hours || isSubmitting}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? '...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeLogWidget;
