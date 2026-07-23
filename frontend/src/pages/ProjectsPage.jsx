import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { getProjects, getProjectMetrics, archiveProject } from '../services/api';
import { resolveApiError } from '../services/api/errors';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectFormModal from '../components/projects/ProjectFormModal';
import Can from '../components/shared/Can';
import usePermissions from '../hooks/usePermissions';
import { projectStatusLabel } from '../i18n/enums';
import { Button } from '../components/ui';
import { cn } from '../lib/cn';

const SkeletonCard = () => (
  <div className="flex h-60 animate-pulse flex-col gap-4 rounded-lg border border-border bg-surface p-5">
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-border" />
      <div className="flex flex-col gap-2">
        <div className="h-4 w-32 rounded bg-border" />
        <div className="h-3 w-16 rounded bg-border" />
      </div>
    </div>
    <div className="h-8 w-full rounded bg-border" />
    <div className="mt-auto h-1.5 w-full rounded bg-border" />
    <div className="flex gap-2">
      <div className="h-5 w-16 rounded-full bg-border" />
      <div className="h-5 w-16 rounded-full bg-border" />
    </div>
  </div>
);

const ViewToggle = ({ view, onChange, t }) => (
  <div className="flex rounded-lg bg-raised p-1" role="group" aria-label={t('projects.viewToggle.aria')}>
    <button
      type="button"
      aria-pressed={view === 'cards'}
      onClick={() => onChange('cards')}
      className={cn(
        'rounded-md px-3 py-1.5 text-[13px] font-medium transition-all',
        view === 'cards' ? 'bg-surface text-fg shadow-soft' : 'text-muted hover:text-fg',
      )}
    >
      {t('projects.viewToggle.cards')}
    </button>
    <button
      type="button"
      aria-pressed={view === 'list'}
      onClick={() => onChange('list')}
      className={cn(
        'rounded-md px-3 py-1.5 text-[13px] font-medium transition-all',
        view === 'list' ? 'bg-surface text-fg shadow-soft' : 'text-muted hover:text-fg',
      )}
    >
      {t('projects.viewToggle.list')}
    </button>
  </div>
);

const ProjectsListTable = ({ projects, metricsData, onEdit, onArchive, canEditProject, canArchive }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!projects?.length) {
    return (
      <div className="rounded-lg border border-border bg-surface p-16 text-center text-muted">
        {t('projects.empty')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead className="border-b border-border bg-raised">
          <tr>
            <th className="px-4 py-3 text-[13px] font-semibold text-muted">{t('projects.list.name')}</th>
            <th className="px-4 py-3 text-[13px] font-semibold text-muted">{t('projects.list.status')}</th>
            <th className="px-4 py-3 text-[13px] font-semibold text-muted">{t('projects.list.progress')}</th>
            <th className="px-4 py-3 text-[13px] font-semibold text-muted">{t('projects.list.tasks')}</th>
            <th className="px-4 py-3 text-right text-[13px] font-semibold text-muted">{t('projects.list.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const metrics = Array.isArray(metricsData)
              ? metricsData.find((m) => m.project_id === project.id)
              : null;
            const completion = metrics?.completion_percentage || 0;
            const totalTasks = metrics?.total_tasks || 0;
            const isArchived = project.status === 'archived';

            return (
              <tr key={project.id} className="border-b border-hairline transition-colors hover:bg-raised">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span aria-hidden="true">{project.icon || '🚀'}</span>
                    <span className="text-sm font-medium text-fg">{project.name}</span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[13px] text-muted">{projectStatusLabel(project.status)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex min-w-[120px] items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${completion}%` }} />
                    </div>
                    <span className="w-10 text-right text-[12px] text-muted">{completion}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-muted">{totalTasks}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      to={`/projects/${project.id}/board`}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-accent hover:text-accent-hover"
                    >
                      {t('projects.card.viewBoard')}
                    </Link>
                    {canEditProject && !isArchived && (
                      <button
                        type="button"
                        onClick={() => onEdit(project)}
                        className="rounded-md px-2 py-1 text-[12px] text-muted hover:text-fg"
                      >
                        {t('projects.card.edit')}
                      </button>
                    )}
                    {canArchive && !isArchived && (
                      <button
                        type="button"
                        onClick={() => onArchive(project)}
                        className="rounded-md px-2 py-1 text-[12px] text-status-blocked hover:bg-status-blocked/10"
                      >
                        {t('projects.card.archive')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ProjectsPage = () => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveError, setArchiveError] = useState(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('projects-view') || 'cards');
  const { canCreateProject, canEditProject, isDeveloper } = usePermissions();
  const canArchive = canEditProject || isDeveloper;

  const setView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('projects-view', mode);
  };

  const listKey = showArchived
    ? '/api/v1/projects?include_archived=true'
    : '/api/v1/projects';
  const listParams = showArchived ? { include_archived: true } : undefined;

  const { data: projects, error: projectsError, isLoading: isLoadingProjects, mutate } = useSWR(
    listKey,
    () => getProjects(listParams),
  );
  const { data: metricsData, isLoading: isLoadingMetrics } = useSWR('/api/v1/metrics/projects', getProjectMetrics, {
    shouldRetryOnError: false,
    onError: (err) => console.warn('Endpoint de métricas pendiente de implementación:', err),
  });

  const isLoading = isLoadingProjects || isLoadingMetrics;
  const hasError = projectsError;

  const handleArchive = async (project) => {
    setArchiveError(null);
    try {
      await archiveProject(project.id);
      await mutate();
    } catch (err) {
      setArchiveError(resolveApiError(err, 'projects.archiveError.fallback'));
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-fg">{t('projects.title')}</h1>
          <p className="mt-1 text-[15px] text-muted">{t('projects.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle view={viewMode} onChange={setView} t={t} />
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-border"
            />
            {t('projects.showArchived')}
          </label>
          <Can permission={canCreateProject}>
            <Button onClick={() => { setEditingProject(null); setShowForm(true); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              {t('projects.newProject')}
            </Button>
          </Can>
        </div>
      </div>

      {hasError && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-status-blocked/40 bg-status-blocked/10 p-4 text-status-blocked">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div>
            <h4 className="font-semibold">{t('projects.loadError.title')}</h4>
            <p className="mt-1 text-sm">{resolveApiError(projectsError, 'projects.loadError.fallback')}</p>
          </div>
        </div>
      )}

      {archiveError && (
        <div className="mb-6 rounded-lg border border-status-blocked/40 bg-status-blocked/10 p-4 text-sm text-status-blocked">
          {archiveError}
        </div>
      )}

      {viewMode === 'list' ? (
        isLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-raised" />
        ) : (
          <ProjectsListTable
            projects={projects}
            metricsData={metricsData}
            onEdit={(p) => { setEditingProject(p); setShowForm(true); }}
            onArchive={handleArchive}
            canEditProject={canEditProject}
            canArchive={canArchive}
          />
        )
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-6">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            projects?.map((project) => {
              const projectMetrics = Array.isArray(metricsData)
                ? metricsData.find((m) => m.project_id === project.id)
                : null;

              const fallbackMetrics = projectMetrics || {
                total_tasks: 0,
                in_progress_tasks: 0,
                blocked_tasks: 0,
                completion_percentage: 0,
              };

              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  metrics={fallbackMetrics}
                  onEdit={(p) => { setEditingProject(p); setShowForm(true); }}
                  onArchive={handleArchive}
                />
              );
            })
          )}
        </div>
      )}

      {showForm && (
        <ProjectFormModal
          project={editingProject}
          onClose={() => { setShowForm(false); setEditingProject(null); }}
          onSaved={() => { mutate(); setShowForm(false); setEditingProject(null); }}
        />
      )}
    </div>
  );
};

export default ProjectsPage;
