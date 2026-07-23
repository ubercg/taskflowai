import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { getProjects, getProjectMetrics } from '../services/api';
import { resolveApiError } from '../services/api/errors';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectFormModal from '../components/projects/ProjectFormModal';
import Can from '../components/shared/Can';
import usePermissions from '../hooks/usePermissions';
import { Button } from '../components/ui';

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

const ProjectsPage = () => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const { canCreateProject } = usePermissions();

  const { data: projects, error: projectsError, isLoading: isLoadingProjects, mutate } = useSWR('/api/v1/projects', getProjects);
  const { data: metricsData, isLoading: isLoadingMetrics } = useSWR('/api/v1/metrics/projects', getProjectMetrics, {
    shouldRetryOnError: false,
    onError: (err) => console.warn('Endpoint de métricas pendiente de implementación:', err),
  });

  const isLoading = isLoadingProjects || isLoadingMetrics;
  const hasError = projectsError;

  return (
    <div className="mx-auto max-w-[1200px] px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-fg">{t('projects.title')}</h1>
          <p className="mt-1 text-[15px] text-muted">{t('projects.subtitle')}</p>
        </div>

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
                onArchive={() => {}}
              />
            );
          })
        )}
      </div>

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
