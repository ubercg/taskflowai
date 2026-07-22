import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { useParams } from 'react-router-dom';
import { getDailySummary } from '../../services/api';
import api from '../../services/api/client';
import TaskModal from './../execution/TaskModal';
import { cn } from '../../lib/cn';
import { taskStatusLabel } from '../../i18n/enums';
import { useLocale } from '../../store/localeStore';
import { getBcp47Locale } from '../../utils/dateUtils';

const SkeletonSummary = () => (
  <div className="flex flex-col gap-3 p-4">
    <div className="h-5 w-2/5 animate-pulse rounded bg-border" />
    <div className="h-3.5 w-full animate-pulse rounded bg-border" />
    <div className="h-3.5 w-4/5 animate-pulse rounded bg-border" />
  </div>
);

const DailySummary = ({ projectId }) => {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { id } = useParams();
  const activeProjectId = projectId || id;
  const [expandedSection, setExpandedSection] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const { data, error, isLoading, mutate } = useSWR(
    activeProjectId ? ['daily-summary', activeProjectId] : null,
    () => getDailySummary(activeProjectId),
    { refreshInterval: 0 },
  );

  const handleRefresh = async () => {
    try {
      await api.get(`/api/v1/ai/daily-summary?project_id=${activeProjectId}&refresh=true`);
      mutate();
    } catch (e) {
      console.error(e);
      mutate();
    }
  };

  const toggleSection = (section) => setExpandedSection((prev) => (prev === section ? null : section));

  if (isLoading) {
    return (
      <div className="min-h-[120px] rounded-lg border border-border border-l-4 border-l-accent bg-surface">
        <SkeletonSummary />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-status-blocked/40 border-l-4 border-l-status-blocked bg-surface p-4">
        <p className="text-sm font-medium text-status-blocked">{t('metrics.summary.errorTitle')}</p>
        <button
          onClick={() => mutate()}
          className="mt-2 rounded border border-status-blocked/40 bg-status-blocked/10 px-2 py-1 text-xs text-status-blocked"
        >
          {t('metrics.summary.retry')}
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Backend genera `summary_text` (rule-based o Gemini) SIEMPRE en español (RN-002).
  // No se traduce: es dato de negocio, no copy de UI. Si el locale activo no es
  // `es`, mostramos un badge para avisar el mismatch de idioma (TSK-020 slice 5).
  const isEmptyActivity = data.stats?.total_moves === 0;
  const showSpanishBadge = !isEmptyActivity && locale !== 'es';

  const categories = [
    { key: 'blocked', label: t('metrics.summary.categories.blocked'), count: data.stats?.blocked_count || data.blocked?.length || 0, tone: 'border-status-blocked/40 bg-status-blocked/10 text-status-blocked' },
    { key: 'advanced', label: t('metrics.summary.categories.advanced'), count: data.advanced?.length || 0, tone: 'border-status-done/40 bg-status-done/10 text-status-done' },
    { key: 'risks', label: t('metrics.summary.categories.risks'), count: data.stats?.at_risk_count || data.risks?.length || 0, tone: 'border-priority-medium/40 bg-priority-medium/10 text-priority-medium' },
  ];

  return (
    <>
      <div className="rounded-lg border border-border border-l-4 border-l-accent bg-surface p-4 shadow-soft">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">✨</span>
            <h3 className="text-[15px] font-semibold text-fg">{t('metrics.summary.title')}</h3>
            <span className="text-xs font-medium text-faint">
              {new Date(data.generated_at).toLocaleTimeString(getBcp47Locale(), { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <span aria-hidden="true">↻</span> {t('metrics.summary.refresh')}
          </button>
        </div>

        {/* Resumen NLP — summary_text es dato de negocio en español (RN-002), no se traduce */}
        <p className={cn('line-clamp-3 text-sm leading-relaxed text-fg', showSpanishBadge ? 'mb-1.5' : 'mb-4')}>
          {isEmptyActivity ? t('metrics.summary.noActivity') : data.summary_text}
        </p>
        {showSpanishBadge && (
          <span className="mb-4 inline-block rounded bg-raised px-1.5 py-0.5 text-[10px] font-medium text-faint">
            {t('metrics.summary.generatedInSpanish')}
          </span>
        )}

        {/* Categorías */}
        <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => toggleSection(cat.key)}
              className={cn(
                'flex flex-1 flex-col items-center rounded-md border p-2 transition-all',
                cat.tone,
                expandedSection !== cat.key && 'border-transparent',
              )}
            >
              <span className="text-base font-bold">{cat.count}</span>
              <span className="mt-0.5 text-[11px] font-semibold uppercase">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Listado expandido */}
        {expandedSection && (
          <div className="mt-4 rounded-md border border-border bg-canvas p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase text-muted">{t('metrics.summary.detailTitle')}</h4>

            {data[expandedSection].length === 0 ? (
              <div className="text-[13px] text-faint">{t('metrics.summary.detailEmpty')}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {data[expandedSection].map((task) => (
                  <div
                    key={task.task_id}
                    onClick={() => setSelectedTask(task.task_id)}
                    className="flex cursor-pointer flex-col gap-1 rounded border border-border bg-surface px-3 py-2 transition-colors hover:border-accent"
                  >
                    <span className="text-[13px] font-medium text-fg">{task.title}</span>
                    <span className="text-[11px] text-muted">
                      {/* blocked_since y reason son texto generado por el backend (RN-002, mismo criterio que summary_text): no se traducen */}
                      {expandedSection === 'blocked' && t('metrics.summary.blockedSince', { time: task.blocked_since })}
                      {expandedSection === 'advanced' && t('metrics.summary.movedFromTo', {
                        from: taskStatusLabel(task.from_status ?? task.from),
                        to: taskStatusLabel(task.to_status ?? task.to),
                      })}
                      {expandedSection === 'risks' && task.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTask && <TaskModal taskId={selectedTask} onClose={() => setSelectedTask(null)} />}
    </>
  );
};

export default DailySummary;
