import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/authStore';
import api from '../services/api/client';
import { getProjects } from '../services/api';
import TaskModal from '../features/execution/TaskModal';
import TimeLogWidget from '../features/operations/TimeLogWidget';
import { formatCalendarShort } from '../utils/dateUtils';
import { taskStatusLabel, taskPriorityLabel } from '../i18n/enums';
import { Button } from '../components/ui';
import { cn } from '../lib/cn';

const STATUS_ORDER = ['in_progress', 'blocked', 'review', 'todo', 'backlog', 'done'];

// Clases estáticas por estado (para que Tailwind las detecte en el build).
// Labels viven en i18n/enums — no duplicar literales aquí (TSK-018).
const STATUS_META = {
  in_progress: { icon: '🔵', text: 'text-status-in_progress', headerBg: 'bg-status-in_progress/10', border: 'border-status-in_progress/30' },
  todo: { icon: '🟡', text: 'text-priority-medium', headerBg: 'bg-priority-medium/10', border: 'border-priority-medium/30' },
  blocked: { icon: '🔴', text: 'text-status-blocked', headerBg: 'bg-status-blocked/10', border: 'border-status-blocked/30' },
  review: { icon: '🟣', text: 'text-status-review', headerBg: 'bg-status-review/10', border: 'border-status-review/30' },
  backlog: { icon: '⚪', text: 'text-muted', headerBg: 'bg-raised', border: 'border-border' },
  done: { icon: '✅', text: 'text-status-done', headerBg: 'bg-status-done/10', border: 'border-status-done/30' },
};

const PRIORITY_DOT = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const getPriorityDot = (priority) => PRIORITY_DOT[priority] || PRIORITY_DOT.medium;

function isCompletedToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
}

const RegisterButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-md border border-border bg-canvas px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-raised hover:text-fg"
  >
    ⏱ Registrar
  </button>
);

function TaskRow({ task, detailed, projectName, onOpen, onLogTime }) {
  const { t } = useTranslation();
  const priority = task.priority || 'medium';
  const priorityDot = getPriorityDot(priority);
  const priorityLabel = taskPriorityLabel(priority);
  return (
    <div className="flex items-center justify-between border-t border-hairline p-4">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: priorityDot }} title={priorityLabel} />
          <h4 onClick={() => onOpen(task.id)} className="cursor-pointer text-[15px] font-medium text-fg hover:underline">
            {task.title}
          </h4>
        </div>
        {detailed && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>📁 {projectName}</span>
            {task.objective_id && (
              <span className="rounded-full bg-status-review/15 px-1.5 py-0.5 font-semibold text-status-review">🎯 OKR #{task.objective_id}</span>
            )}
            <span>📅 {task.due_date ? formatCalendarShort(task.due_date) : t('common.noDate')}</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {detailed && (
          <div className="text-right">
            <div className="text-sm font-semibold text-fg">{task.logged_hours || 0}h</div>
            <div className="text-[11px] text-faint">/ {task.estimated_hours ?? '-'}h est.</div>
          </div>
        )}
        <RegisterButton onClick={(e) => onLogTime(e, task.id)} />
      </div>
    </div>
  );
}

const MyTasksPage = () => {
  // Subscribe so enum labels / dates re-render on locale change (TSK-018).
  useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('status');
  const [expandedSections, setExpandedSections] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTimeLogWidget, setActiveTimeLogWidget] = useState(null);
  const [widgetAnchor, setWidgetAnchor] = useState(null);

  const openWidget = (e, taskId) => {
    if (activeTimeLogWidget === taskId) {
      setActiveTimeLogWidget(null);
      setWidgetAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveTimeLogWidget(taskId);
      setWidgetAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
  };

  const closeWidget = () => { setActiveTimeLogWidget(null); setWidgetAnchor(null); };
  const openDetail = (taskId) => { closeWidget(); setSelectedTask(taskId); };

  const { data: tasks, isLoading, mutate } = useSWR(
    user ? `/api/v1/tasks?assignee_id=${user.id}` : null,
    () => api.get(`/api/v1/tasks?assignee_id=${user.id}`).then((res) => res.data),
  );

  const { data: velocity } = useSWR(
    user ? `/api/v1/metrics/velocity` : null,
    () => api.get('/api/v1/metrics/velocity').then((res) => res.data),
  );

  const { data: projects } = useSWR(user ? '/api/v1/projects' : null, getProjects);

  const userVelocity = useMemo(() => {
    if (!velocity?.length || user?.id == null) return null;
    return velocity.find((v) => Number(v.user_id) === Number(user.id)) ?? null;
  }, [velocity, user?.id]);

  const projectNameById = useMemo(() => {
    const map = {};
    (projects || []).forEach((p) => { map[p.id] = p.name; });
    return map;
  }, [projects]);

  const myTasks = tasks || [];

  const groupedByStatus = useMemo(() => myTasks.reduce((acc, task) => {
    const s = task.status || 'backlog';
    (acc[s] = acc[s] || []).push(task);
    return acc;
  }, {}), [myTasks]);

  const stats = useMemo(() => {
    const count = (k) => (groupedByStatus[k] ? groupedByStatus[k].length : 0);
    const doneToday = myTasks.filter((t) => t.status === 'done' && isCompletedToday(t.completed_at)).length;
    return {
      inProgress: count('in_progress'),
      todo: count('todo'),
      doneToday,
      total: myTasks.length,
      hoursWeek: userVelocity?.total_hours ?? 0,
    };
  }, [myTasks, groupedByStatus, userVelocity]);

  const groupedByProjectId = useMemo(() => myTasks.reduce((acc, task) => {
    (acc[task.project_id] = acc[task.project_id] || []).push(task);
    return acc;
  }, {}), [myTasks]);

  const groupedByPriority = useMemo(() => myTasks.reduce((acc, task) => {
    const p = task.priority || 'medium';
    (acc[p] = acc[p] || []).push(task);
    return acc;
  }, {}), [myTasks]);

  const toggleSection = (status) => {
    setExpandedSections((prev) => {
      const groupTasks = groupedByStatus[status] || [];
      const current = prev[status] !== undefined ? prev[status] : groupTasks.length > 0;
      return { ...prev, [status]: !current };
    });
  };

  const handleLogged = (newLog) => {
    const list = tasks || [];
    mutate(list.map((t) => (t.id === newLog.task_id ? { ...t, logged_hours: (t.logged_hours || 0) + newLog.hours } : t)), false);
    alert(`✓ ${newLog.hours}h registradas en la tarea`);
    mutate();
  };

  if (isLoading) return <div className="p-8 text-muted">Cargando tus tareas...</div>;

  const firstName = user?.name?.split(' ')[0] ?? 'Usuario';

  return (
    <div className="mx-auto max-w-[1000px] px-4">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-[28px] font-semibold tracking-tight text-fg">Mis Tareas</h1>
          <p className="text-[15px] text-muted">Hola, {firstName} 👋</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <div className="flex flex-col gap-1 rounded-[10px] border border-status-in_progress/30 bg-status-in_progress/10 px-4 py-3.5">
          <span className="text-xs font-semibold text-status-in_progress">En progreso</span>
          <span className="text-[26px] font-bold leading-none text-status-in_progress">{stats.inProgress}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-priority-medium/30 bg-priority-medium/10 px-4 py-3.5">
          <span className="text-xs font-semibold text-priority-medium">Por hacer</span>
          <span className="text-[26px] font-bold leading-none text-priority-medium">{stats.todo}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-status-done/30 bg-status-done/10 px-4 py-3.5">
          <span className="text-xs font-semibold text-status-done">Completadas hoy</span>
          <span className="text-[26px] font-bold leading-none text-status-done">{stats.doneToday}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-surface px-4 py-3.5">
          <span className="text-xs font-semibold text-muted">Horas esta semana</span>
          <span className="text-[26px] font-bold leading-none text-fg">
            {typeof stats.hoursWeek === 'number' ? stats.hoursWeek.toFixed(1) : '0'}h
          </span>
        </div>
      </div>

      <p className="-mt-3 mb-6 text-[13px] text-muted">
        {stats.total === 0 ? 'No tienes tareas asignadas.' : `${stats.total} tarea${stats.total === 1 ? '' : 's'} asignada${stats.total === 1 ? '' : 's'}`}
      </p>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border pb-4">
        {['status', 'project', 'priority'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-full border px-4 py-2 text-[13px] font-semibold transition-all',
              activeTab === tab ? 'border-border bg-surface text-fg shadow-soft' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            Por {tab === 'status' ? 'Estado' : tab === 'project' ? 'Proyecto' : 'Prioridad'}
          </button>
        ))}
      </div>

      {myTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
          <div className="mb-4 text-5xl">🎉</div>
          <h3 className="mb-2 text-lg font-semibold text-fg">No tienes tareas asignadas</h3>
          <p className="mb-6 text-sm text-muted">Tu bandeja está limpia. Disfruta tu día o busca algo en qué trabajar.</p>
          <Link to="/projects">
            <Button>Ver todos los proyectos</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-16">
          {activeTab === 'status' &&
            STATUS_ORDER.map((status) => {
              const groupTasks = groupedByStatus[status] || [];
              const meta = STATUS_META[status] || STATUS_META.backlog;
              const isExpanded = expandedSections[status] !== undefined ? expandedSections[status] : groupTasks.length > 0;

              return (
                <div key={status} className={cn('overflow-hidden rounded-xl border bg-surface', meta.border)}>
                  <button
                    type="button"
                    onClick={() => toggleSection(status)}
                    className={cn('flex w-full items-center justify-between p-4 text-left', meta.headerBg)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meta.icon}</span>
                      <span className={cn('text-[15px] font-semibold', meta.text)}>{taskStatusLabel(status)} ({groupTasks.length})</span>
                    </div>
                    <svg
                      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={cn('transition-transform duration-200', meta.text, isExpanded && 'rotate-180')}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isExpanded &&
                    (groupTasks.length === 0 ? (
                      <div className="border-t border-hairline p-5 text-center text-[13px] text-faint">No hay tareas en este estado</div>
                    ) : (
                      <div className="flex flex-col">
                        {groupTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            detailed
                            projectName={projectNameById[task.project_id] || `Proyecto ${task.project_id}`}
                            onOpen={openDetail}
                            onLogTime={openWidget}
                          />
                        ))}
                      </div>
                    ))}
                </div>
              );
            })}

          {activeTab === 'project' &&
            Object.entries(groupedByProjectId).map(([projectId, groupTasks]) => {
              const name = projectNameById[Number(projectId)] || `Proyecto ${projectId}`;
              return (
                <div key={projectId} className="overflow-hidden rounded-xl border border-border bg-surface">
                  <div className="border-b border-border bg-raised p-4 font-semibold text-fg">📁 {name} ({groupTasks.length})</div>
                  <div className="flex flex-col">
                    {groupTasks.map((task) => (
                      <TaskRow key={task.id} task={task} onOpen={openDetail} onLogTime={openWidget} />
                    ))}
                  </div>
                </div>
              );
            })}

          {activeTab === 'priority' &&
            ['critical', 'high', 'medium', 'low'].map((priority) => {
              const groupTasks = groupedByPriority[priority] || [];
              if (groupTasks.length === 0) return null;
              const priorityDot = getPriorityDot(priority);

              return (
                <div key={priority} className="overflow-hidden rounded-xl border border-border bg-surface">
                  <div className="flex items-center gap-2 border-b border-border bg-raised p-4 font-semibold text-fg">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: priorityDot }} />
                    {taskPriorityLabel(priority)} ({groupTasks.length})
                  </div>
                  <div className="flex flex-col">
                    {groupTasks.map((task) => (
                      <TaskRow key={task.id} task={task} onOpen={openDetail} onLogTime={openWidget} />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {activeTimeLogWidget && <div onClick={closeWidget} className="fixed inset-0 z-[998]" />}
      {activeTimeLogWidget && widgetAnchor && (() => {
        const activeTask = myTasks.find((t) => t.id === activeTimeLogWidget);
        return activeTask ? (
          <TimeLogWidget task={activeTask} anchor={widgetAnchor} onClose={closeWidget} onLogged={handleLogged} />
        ) : null;
      })()}

      {selectedTask && <TaskModal taskId={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
};

export default MyTasksPage;
