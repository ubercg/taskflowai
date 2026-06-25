import React, { useState, useCallback } from 'react';
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
import { parseDateOnly } from '../../utils/dateUtils';
import CalendarPdfReport from './CalendarPdfReport';

const STATUS_STYLE = {
  backlog:     { bg: '#f1f5f9', color: '#475569', label: 'Backlog' },
  todo:        { bg: '#e0e7ff', color: '#1e40af', label: 'To Do' },
  in_progress: { bg: '#fef3c7', color: '#b45309', label: 'In Progress' },
  review:      { bg: '#f3e8ff', color: '#6b21a8', label: 'Review' },
  done:        { bg: '#dcfce3', color: '#166534', label: 'Done' },
  blocked:     { bg: '#fee2e2', color: '#b91c1c', label: 'Blocked' },
};

const DAY_HEADERS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

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
  const statusStyle = STATUS_STYLE[task.status] || { bg: '#e2e8f0', color: '#0f172a', label: task.status };
  const timeLabel = task.due_date ? format(new Date(task.due_date), 'HH:mm') : null;

  return (
    <div
      onClick={onClick}
      title={task.title}
      style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderLeft: '3px solid ' + statusStyle.color,
        borderRadius: '4px',
        padding: '4px 6px',
        marginBottom: '4px',
        fontSize: '11px',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.15)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {timeLabel && (
        <div style={{ color: '#64748b', marginBottom: '2px' }}>{timeLabel}</div>
      )}
      <div
        style={{
          fontWeight: 500,
          color: '#0f172a',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '2px',
          maxWidth: '100%',
        }}
      >
        {task.title}
      </div>
      <span
        style={{
          backgroundColor: statusStyle.bg,
          color: statusStyle.color,
          padding: '1px 6px',
          borderRadius: '9999px',
          fontSize: '10px',
          fontWeight: 500,
          display: 'inline-block',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {statusStyle.label}
      </span>
    </div>
  );
}

function CalendarView({ projectId, onTaskClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [preparingPdf, setPreparingPdf] = useState(false);

  // El reporte de metricas se monta fuera de pantalla al exportar; cuando sus
  // datos/charts estan listos imprimimos y lo desmontamos.
  const handleReportReady = useCallback(() => {
    // Doble rAF: garantiza que el SVG de los charts ya pinto antes de imprimir.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.print();
        setPreparingPdf(false);
      })
    );
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  // Rango para /tasks/calendar: inclusivo hasta el último día del mes (p.ej. 2026-06-30)
  const startDate = format(monthStart, 'yyyy-MM-dd');
  const endDate = format(monthEnd, 'yyyy-MM-dd');

  // Rango medio-abierto [start, end) para endpoints de métricas — el backend espera
  // end = primer día del mes siguiente (límite superior exclusivo), no fin de mes.
  // Ver ADR-3 en el diseño de monthly-metrics.
  const metricsStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const metricsEnd = format(startOfMonth(addMonths(currentMonth, 1)), 'yyyy-MM-dd');
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  const { data: tasks = [], error, isLoading } = useSWR(
    projectId ? ['/api/v1/tasks/calendar', projectId, startDate, endDate] : null,
    () => getCalendarTasks(projectId, startDate, endDate)
  );

  if (!projectId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Por favor selecciona un proyecto para ver el calendario.
      </div>
    );
  }

  const filteredTasks = statusFilter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === statusFilter);

  const getTasksForDay = (day) =>
    filteredTasks.filter((task) => {
      if (task.due_date && isSameDay(parseDateOnly(task.due_date), day)) return true;
      if (task.start_date && isSameDay(parseDateOnly(task.start_date), day)) return true;
      return false;
    });

  const weeks = buildGrid(currentMonth);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
        Calendario del Proyecto
      </h2>

      <div
        className="calendar-no-print"
        style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '1rem 1.5rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            style={{
              background: 'none',
              border: '1px solid #e2e8f0',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            ←
          </button>
          <span style={{ fontWeight: 600, color: '#1e293b', minWidth: '140px', textAlign: 'center' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            style={{
              background: 'none',
              border: '1px solid #e2e8f0',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            →
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>
            Filtrar por fecha:
          </label>
          <input
            type="date"
            value={startDate}
            readOnly
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              color: '#334155',
            }}
          />
          <span style={{ color: '#94a3b8' }}>–</span>
          <input
            type="date"
            value={endDate}
            readOnly
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              color: '#334155',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>
            Filtrar por estado:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="all">Todos los estados</option>
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        <button
          onClick={() => setStatusFilter('all')}
          style={{
            background: 'none',
            border: '1px solid #e2e8f0',
            borderRadius: '0.25rem',
            padding: '0.25rem 0.75rem',
            fontSize: '0.875rem',
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          Limpiar Filtros
        </button>

        <button
          onClick={() => setPreparingPdf(true)}
          disabled={preparingPdf}
          title="Exportar el calendario y las métricas a PDF (horizontal)"
          style={{
            marginLeft: 'auto',
            background: preparingPdf ? '#a5b4fc' : '#6366f1',
            border: `1px solid ${preparingPdf ? '#a5b4fc' : '#6366f1'}`,
            borderRadius: '0.25rem',
            padding: '0.25rem 0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
            cursor: preparingPdf ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          {preparingPdf ? 'Preparando…' : '⤓ Exportar PDF'}
        </button>

        {isLoading && (
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Cargando...</span>
        )}
        {error && (
          <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>Error al cargar las tareas.</span>
        )}
      </div>

      <div
        className="calendar-print-area"
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
        }}
      >
        <div
          className="calendar-print-header"
          style={{
            padding: '0.75rem 1rem',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: '#1e293b',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          Calendario — {format(currentMonth, 'MMMM yyyy')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '2px solid #e2e8f0',
          }}
        >
          {DAY_HEADERS.map((day) => (
            <div
              key={day}
              style={{
                minWidth: 0,
                padding: '0.5rem',
                textAlign: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#64748b',
                letterSpacing: '0.05em',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div
            key={wi}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              borderBottom: wi < weeks.length - 1 ? '1px solid #e2e8f0' : 'none',
            }}
          >
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
                  className="calendar-cell"
                  style={{
                    minHeight: '120px',
                    minWidth: 0,
                    overflow: 'hidden',
                    padding: '6px',
                    borderLeft: di > 0 ? '1px solid #e2e8f0' : 'none',
                    borderTop: today ? '3px solid #6366f1' : undefined,
                    backgroundColor: inMonth ? 'white' : '#f8fafc',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: today ? 700 : 400,
                      color: today ? '#6366f1' : inMonth ? '#334155' : '#94a3b8',
                      opacity: inMonth ? 1 : 0.4,
                      marginBottom: '4px',
                    }}
                  >
                    {format(day, 'd')} {format(day, 'MMM').toUpperCase()}
                  </div>
                  <div>
                    {visible.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick && onTaskClick(task.id)}
                      />
                    ))}
                    {/* Tareas extra: ocultas en pantalla, expandidas solo en el PDF */}
                    {overflow > 0 && (
                      <div className="calendar-print-only-tasks">
                        {dayTasks.slice(MAX_VISIBLE).map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => onTaskClick && onTaskClick(task.id)}
                          />
                        ))}
                      </div>
                    )}
                    {overflow > 0 && (
                      <div
                        className="calendar-no-print"
                        style={{
                          fontSize: '10px',
                          color: '#6366f1',
                          fontWeight: 600,
                          padding: '2px 4px',
                          cursor: 'default',
                        }}
                      >
                        +{overflow} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Bloque de metricas para el PDF: se monta solo al exportar */}
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
