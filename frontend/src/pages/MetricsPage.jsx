import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { getProject } from '../services/api';
import MetricsDashboard from '../features/analytics/MetricsDashboard';
import { Button } from '../components/ui';

const MetricsPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();

  const { data: project } = useSWR(`/api/v1/projects/${id}`, () => getProject(id));

  return (
    <div className="flex h-screen flex-col overflow-y-auto bg-canvas">
      {/* Header consistente con BoardPage */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 pb-6 pt-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            {project?.name || t('execution.board.loadingTitle')}
          </h1>

          <div className="flex rounded-lg bg-raised p-1">
            <Link
              to={`/projects/${id}/board`}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
            >
              {t('execution.board.views.kanban')}
            </Link>
            <span className="cursor-default rounded-md bg-surface px-3 py-1.5 text-[13px] font-medium text-fg shadow-soft">
              {t('execution.board.metricsLink')}
            </span>
          </div>
        </div>

        <Button variant="secondary" size="sm">{t('metrics.page.exportPdf')}</Button>
      </div>

      {/* Dashboard */}
      <div className="flex-1">
        <MetricsDashboard projectId={id} />
      </div>
    </div>
  );
};

export default MetricsPage;
