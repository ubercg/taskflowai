import React, { useState } from 'react';
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

function TaskCard({ task }) {
  const statusStyle = STATUS_STYLE[task.status] || { bg: '#e2e8f0', color: '#0f172a', label: task.status };
  const timeLabel = task.due_date ? format(new Date(task.due_date), 'HH:mm') : null;

  return (
    <div
      style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderLeft: '3px solid ' + statusStyle.color,
        borderRadius: '4px',
        padding: '4px 6px',
        marginBottom: '4px',
        fontSize: '11px',
        cursor: 'default',
        overflow: 'hidden',
      }}
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
        }}
      >
        {statusStyle.label}
      </span>
    </div>
  );
}

function CalendarView({ projectId }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = format(monthStart, 'yyyy-MM-dd');
  const endDate = format(monthEnd, 'yyyy-MM-dd');

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
      if (task.due_date && isSameDay(new Date(task.due_date), day)) return true;
      if (task.start_date && isSameDay(new Date(task.start_date), day)) return true;
      return false;
    });

  const weeks = buildGrid(currentMonth);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
        Calendario del Proyecto
      </h2>

      <div
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

        {isLoading && (
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Cargando...</span>
        )}
        {error && (
          <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>Error al cargar las tareas.</span>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
        }}
      >
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

              return (
                <div
                  key={di}
                  style={{
                    minHeight: '120px',
                    padding: '6px',
                    borderLeft: di > 0 ? '1px solid #e2e8f0' : 'none',
                    borderTop: today ? '3px solid #6366f1' : undefined,
                    backgroundColor: inMonth ? 'white' : '#f8fafc',
                    verticalAlign: 'top',
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
                    {dayTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CalendarView;
