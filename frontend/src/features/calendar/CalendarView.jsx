import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import {
  format,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  isToday,
  eachDayOfInterval,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { getCalendarTasks } from '../../services/api';
import { parseDateOnly, formatLocalized } from '../../utils/dateUtils';
import { useLocale } from '../../store/localeStore';
import { taskStatusLabel } from '../../i18n/enums';
import CalendarPdfReport from './CalendarPdfReport';
import { cn } from '../../lib/cn';

// Colores de estado para los pills (pastel; legibles en claro/oscuro y en el PDF).
// Solo color, sin texto: las etiquetas se resuelven vía taskStatusLabel() en render
// para no congelar el idioma al importar el módulo.
const STATUS_STYLE = {
  backlog:     { bg: '#f1f5f9', color: '#475569' },
  todo:        { bg: '#e0e7ff', color: '#1e40af' },
  in_progress: { bg: '#fef3c7', color: '#b45309' },
  review:      { bg: '#f3e8ff', color: '#6b21a8' },
  done:        { bg: '#dcfce3', color: '#166534' },
  blocked:     { bg: '#fee2e2', color: '#b91c1c' },
};

const STATUS_ORDER = ['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked'];

function buildGrid(currentMonth) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function TaskCard({ task, onClick }) {
  const statusStyle = STATUS_STYLE[task.status] || { bg: '#e2e8f0', color: '#0f172a' };
  const timeLabel = task.due_date ? format(new Date(task.due_date), 'HH:mm') : null;

  return (
    <div
      onClick={onClick}
      title={task.title}
      className="mb-1 cursor-pointer overflow-hidden rounded border border-border bg-surface px-1.5 py-1 text-[11px] transition-shadow hover:shadow-card"
      style={{ borderLeft: '3px solid ' + statusStyle.color }}
    >
      {timeLabel && <div className="mb-0.5 text-muted">{timeLabel}</div>}
      <div className="mb-0.5 max-w-full truncate font-medium text-fg">{task.title}</div>
      <span
        className="inline-block max-w-full truncate rounded-full px-1.5 text-[10px] font-medium"
        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
      >
        {taskStatusLabel(task.status)}
      </span>
    </div>
  );
}

function CalendarView({ projectId, onTaskClick }) {
  const { t } = useTranslation();
  useLocale();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [preparingPdf, setPreparingPdf] = useState(false);

  const handleReportReady = useCallback(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.print();
        setPreparingPdf(false);
      }),
    );
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = format(monthStart, 'yyyy-MM-dd');
  const endDate = format(monthEnd, 'yyyy-MM-dd');

  const metricsStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const metricsEnd = format(startOfMonth(addMonths(currentMonth, 1)), 'yyyy-MM-dd');
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  const { data: tasks = [], error, isLoading } = useSWR(
    projectId ? ['/api/v1/tasks/calendar', projectId, startDate, endDate] : null,
    () => getCalendarTasks(projectId, startDate, endDate),
  );

  if (!projectId) {
    return <div className="p-8 text-center text-muted">{t('calendar.view.noProject')}</div>;
  }

  const filteredTasks = statusFilter === 'all' ? tasks : tasks.filter((task) => task.status === statusFilter);

  const getTasksForDay = (day) =>
    filteredTasks.filter((task) => {
      if (task.due_date && isSameDay(parseDateOnly(task.due_date), day)) return true;
      if (task.start_date && isSameDay(parseDateOnly(task.start_date), day)) return true;
      return false;
    });

  const weeks = buildGrid(currentMonth);
  // Encabezados de día siguiendo el locale activo (RN-011): weeks[0] siempre
  // arranca en lunes (weekStartsOn: 1) sin importar el mes visible.
  const dayHeaders = weeks[0].map((day) => formatLocalized(day, 'EEE').toUpperCase());
  const navBtn = 'rounded border border-border px-2 py-1 text-base text-muted transition-colors hover:bg-raised hover:text-fg';
  const dateInput = 'rounded border border-border bg-canvas px-2 py-1 text-sm text-fg outline-none';

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-4 text-xl font-semibold text-fg">{t('calendar.view.title')}</h2>

      <div className="calendar-no-print mb-4 flex flex-wrap items-center gap-8 rounded-lg border border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-2">
          <button aria-label={t('calendar.view.prevMonth')} onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className={navBtn}>←</button>
          <span className="min-w-[140px] text-center font-semibold capitalize text-fg">{formatLocalized(currentMonth, 'MMMM yyyy')}</span>
          <button aria-label={t('calendar.view.nextMonth')} onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className={navBtn}>→</button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted">{t('calendar.view.filterByDate')}</label>
          <input type="date" value={startDate} readOnly className={dateInput} />
          <span className="text-faint">–</span>
          <input type="date" value={endDate} readOnly className={dateInput} />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted">{t('calendar.view.filterByStatus')}</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cn(dateInput, 'cursor-pointer')}>
            <option value="all">{t('calendar.view.allStatuses')}</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{taskStatusLabel(status)}</option>
            ))}
          </select>
        </div>

        <button onClick={() => setStatusFilter('all')} className="rounded border border-border px-3 py-1 text-sm text-muted transition-colors hover:bg-raised hover:text-fg">
          {t('calendar.view.clearFilters')}
        </button>

        <button
          onClick={() => setPreparingPdf(true)}
          disabled={preparingPdf}
          title={t('calendar.view.exportPdfTitle')}
          className="ml-auto flex items-center gap-1.5 rounded bg-accent px-3 py-1 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
        >
          {preparingPdf ? t('calendar.view.exportingPdf') : <><span aria-hidden="true">⤓</span> {t('calendar.view.exportPdf')}</>}
        </button>

        {isLoading && <span className="text-sm text-muted">{t('calendar.view.loading')}</span>}
        {error && <span className="text-sm text-status-blocked">{t('calendar.view.loadError')}</span>}
      </div>

      <div className="calendar-print-area flex-1 overflow-auto rounded-lg border border-border bg-surface">
        <div className="calendar-print-header border-b border-border px-4 py-3 text-[1.1rem] font-bold text-fg">
          {t('calendar.view.printHeader', { month: formatLocalized(currentMonth, 'MMMM yyyy') })}
        </div>
        <div className="grid grid-cols-7 border-b-2 border-border">
          {dayHeaders.map((day) => (
            <div key={day} className="min-w-0 p-2 text-center text-xs font-semibold tracking-wider text-muted">{day}</div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className={cn('grid grid-cols-7', wi < weeks.length - 1 && 'border-b border-border')}>
            {week.map((day, di) => {
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const dayTasks = getTasksForDay(day);

              const MAX_VISIBLE = 3;
              const visible = dayTasks.slice(0, MAX_VISIBLE);
              const overflow = dayTasks.length - MAX_VISIBLE;

              return (
                <div
                  key={di}
                  className={cn(
                    'calendar-cell min-h-[120px] min-w-0 overflow-hidden p-1.5',
                    di > 0 && 'border-l border-border',
                    today && 'border-t-[3px] border-t-accent',
                    inMonth ? 'bg-surface' : 'bg-canvas',
                  )}
                >
                  <div className={cn('mb-1 text-xs', today ? 'font-bold text-accent' : inMonth ? 'text-fg' : 'text-faint opacity-40')}>
                    {format(day, 'd')} {formatLocalized(day, 'MMM').toUpperCase()}
                  </div>
                  <div>
                    {visible.map((task) => (
                      <TaskCard key={task.id} task={task} onClick={() => onTaskClick && onTaskClick(task.id)} />
                    ))}
                    {overflow > 0 && (
                      <div className="calendar-print-only-tasks">
                        {dayTasks.slice(MAX_VISIBLE).map((task) => (
                          <TaskCard key={task.id} task={task} onClick={() => onTaskClick && onTaskClick(task.id)} />
                        ))}
                      </div>
                    )}
                    {overflow > 0 && (
                      <div className="calendar-no-print px-1 py-0.5 text-[10px] font-semibold text-accent">
                        {t('calendar.view.overflowMore', { count: overflow })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Bloque de métricas para el PDF: se monta solo al exportar y se imprime en claro */}
        {preparingPdf && (
          <CalendarPdfReport
            projectId={projectId}
            startDate={metricsStart}
            endDate={metricsEnd}
            isCurrentMonth={isCurrentMonth}
            onReady={handleReportReady}
          />
        )}
      </div>
    </div>
  );
}

export default CalendarView;
