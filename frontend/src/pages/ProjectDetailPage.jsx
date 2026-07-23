import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { getProject, getObjectives, getProjectMetrics } from '../services/api';
import api from '../services/api/client';
import usePermissions from '../hooks/usePermissions';
import Can from '../components/shared/Can';
import ProjectFormModal from '../components/projects/ProjectFormModal';
import ObjectiveFormModal from '../components/projects/ObjectiveFormModal';
import MembersPanel from '../components/projects/MembersPanel';
import ObjectiveTasksPanel from '../components/projects/ObjectiveTasksPanel';
import { formatCalendarLocale } from '../utils/dateUtils';
import { projectStatusLabel, userRoleLabel } from '../i18n/enums';
import { Button } from '../components/ui';
import { cn } from '../lib/cn';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const getProgressColor = (percentage) => {
  if (percentage < 30) return '#f87171';
  if (percentage <= 70) return '#fb923c';
  return '#4ade80';
};

const ProjectDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEditProject, isDeveloper } = usePermissions();
  const canManageProject = canEditProject || isDeveloper;

  const [showEditProject, setShowEditProject] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState(null);

  const { data: project, mutate: mutateProject } = useSWR(`/api/v1/projects/${id}`, () => getProject(id));
  const { data: objectives, mutate: mutateObjectives } = useSWR(`/api/v1/objectives?project_id=${id}`, () => getObjectives(id));
  const { data: members } = useSWR(
    `/api/v1/projects/${id}/members`,
    () => api.get(`/api/v1/projects/${id}/members`).then((res) => res.data),
    { fallbackData: [] },
  );
  const { data: metricsData } = useSWR('/api/v1/metrics/projects', () => getProjectMetrics());

  const projectMetrics = Array.isArray(metricsData)
    ? metricsData.find((m) => m.project_id === Number(id))
    : { total_tasks: 0, completed_tasks: 0, in_progress_tasks: 0, blocked_tasks: 0 };

  if (!project) {
    return <div className="p-8 text-muted">{t('projects.detail.loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-[1_1_600px] flex-col gap-6">
          <div className="relative rounded-xl border border-border bg-surface p-8">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl" style={{ backgroundColor: project.color || '#6366f1' }}>
                {project.icon || '🚀'}
              </div>
              <div>
                <h1 className="text-[28px] font-bold tracking-tight text-fg">{project.name}</h1>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
                      project.status === 'active' ? 'bg-status-done/15 text-status-done' : 'bg-raised text-muted',
                    )}
                  >
                    {projectStatusLabel(project.status || 'active')}
                  </span>
                  <span className="flex items-center gap-1 text-[13px] text-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    {t('projects.detail.createdOn', { date: formatCalendarLocale(project.created_at) })}
                  </span>
                </div>
              </div>
            </div>

            <p className="mb-6 text-[15px] leading-relaxed text-fg">
              {project.description || t('projects.detail.noDescription')}
            </p>

            <div className="flex gap-3">
              <Can permission={canEditProject}>
                <Button variant="secondary" size="sm" onClick={() => setShowEditProject(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  {t('projects.detail.editProject')}
                </Button>
              </Can>
              <Button size="sm" onClick={() => navigate(`/projects/${id}/board`)}>{t('projects.detail.goToBoard')}</Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-fg">{t('projects.objectives.title')}</h2>
              <Can permission={canManageProject}>
                <button
                  onClick={() => { setEditingObjective(null); setShowObjectiveForm(true); }}
                  className="rounded-md border border-accent/40 bg-canvas px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
                >
                  {t('projects.objectives.new')}
                </button>
              </Can>
            </div>

            {!objectives || objectives.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-faint">
                {t('projects.objectives.empty')}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {objectives.map((obj) => (
                  <div key={obj.id} className="overflow-hidden rounded-lg border border-border">
                    <div
                      onClick={() => setExpandedObjectiveId(expandedObjectiveId === obj.id ? null : obj.id)}
                      className={cn('flex cursor-pointer items-center gap-4 p-4 transition-colors', expandedObjectiveId === obj.id ? 'bg-raised' : 'bg-surface')}
                    >
                      <div className="flex-1">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate text-[15px] font-semibold text-fg">{obj.title}</h3>
                            {obj.mode && (
                              <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                                {obj.mode === 'manual'
                                  ? t('projects.objectives.modeManual')
                                  : t('projects.objectives.modeMilestone')}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 text-xs font-medium text-muted">{obj.progress || 0}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                          <div className="h-full" style={{ width: `${obj.progress || 0}%`, backgroundColor: getProgressColor(obj.progress || 0) }} />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs text-muted">
                          <div>{t('projects.objectives.due')}</div>
                          <div className="font-medium text-fg">{formatCalendarLocale(obj.due_date)}</div>
                        </div>
                        <Can permission={canManageProject}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingObjective(obj); setShowObjectiveForm(true); }}
                            title={t('projects.objectives.edit')}
                            className="flex p-1 text-faint transition-colors hover:text-fg"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                        </Can>
                        {obj.owner_id ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-faint text-[11px] font-semibold text-white">
                            U{obj.owner_id}
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full border border-dashed border-border bg-raised" />
                        )}
                        <svg
                          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={cn('text-faint transition-transform duration-200', expandedObjectiveId === obj.id && 'rotate-180')}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </div>

                    {expandedObjectiveId === obj.id && (
                      <ObjectiveTasksPanel objective={obj} projectId={id} onClose={() => setExpandedObjectiveId(null)} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-[1_1_300px] flex-col gap-6">
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-fg">{t('projects.detail.team')}</h3>
              <Can permission={canEditProject}>
                <button onClick={() => setShowMembersPanel(true)} className="text-[13px] font-medium text-accent hover:text-accent-hover">
                  {t('projects.detail.manageTeam')}
                </button>
              </Can>
            </div>

            <div className="flex flex-col gap-3">
              {members?.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ backgroundColor: member.color || 'var(--color-faint)' }}>
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate text-sm font-medium text-fg">{member.name}</div>
                    <div className="text-xs text-muted">{userRoleLabel(member.role)}</div>
                  </div>
                </div>
              ))}
              {members?.length === 0 && <span className="text-[13px] text-faint">{t('projects.detail.noMembers')}</span>}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="mb-4 text-base font-semibold text-fg">{t('projects.detail.quickSummary')}</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-canvas p-4">
                <div className="text-2xl font-bold text-fg">{projectMetrics?.total_tasks || 0}</div>
                <div className="text-xs font-medium uppercase text-muted">{t('projects.detail.stats.total')}</div>
              </div>
              <div className="rounded-lg border border-status-done/20 bg-status-done/10 p-4">
                <div className="text-2xl font-bold text-status-done">{projectMetrics?.completed_tasks || 0}</div>
                <div className="text-xs font-medium uppercase text-status-done">{t('projects.detail.stats.done')}</div>
              </div>
              <div className="rounded-lg border border-status-in_progress/20 bg-status-in_progress/10 p-4">
                <div className="text-2xl font-bold text-status-in_progress">{projectMetrics?.in_progress_tasks || 0}</div>
                <div className="text-xs font-medium uppercase text-status-in_progress">{t('projects.detail.stats.wip')}</div>
              </div>
              <div className="rounded-lg border border-status-blocked/20 bg-status-blocked/10 p-4">
                <div className="text-2xl font-bold text-status-blocked">{projectMetrics?.blocked_tasks || 0}</div>
                <div className="text-xs font-medium uppercase text-status-blocked">{t('projects.detail.stats.blocked')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEditProject && (
        <ProjectFormModal project={project} onClose={() => setShowEditProject(false)} onSaved={() => { mutateProject(); setShowEditProject(false); }} />
      )}
      {showObjectiveForm && (
        <ObjectiveFormModal projectId={id} objective={editingObjective} onClose={() => setShowObjectiveForm(false)} onSaved={() => { mutateObjectives(); setShowObjectiveForm(false); }} />
      )}
      {showMembersPanel && <MembersPanel projectId={id} onClose={() => setShowMembersPanel(false)} />}
    </div>
  );
};

export default ProjectDetailPage;
