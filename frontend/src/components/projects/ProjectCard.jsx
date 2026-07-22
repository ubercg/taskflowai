import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import usePermissions from '../../hooks/usePermissions';
import { projectStatusLabel } from '../../i18n/enums';
import { cn } from '../../lib/cn';

const getStatusColor = (status) => {
  switch (status) {
    case 'active': return '#22c55e';
    case 'on_hold': return '#eab308';
    case 'completed': return '#94a3b8';
    default: return '#94a3b8';
  }
};

const getProgressColor = (percentage) => {
  if (percentage < 30) return '#f87171';
  if (percentage <= 70) return '#fb923c';
  return '#4ade80';
};

const ProjectCard = ({ project, metrics, onEdit, onArchive }) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
  const { canEditProject, canDeleteProject } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const color = project.color || '#6366f1';
  const icon = project.icon || '🚀';
  const description = project.description || t('projects.card.defaultDescription');
  const ownerAvatar = project.owner_avatar || `https://ui-avatars.com/api/?name=${project.name}&background=random&color=fff`;

  const completionPercentage = metrics?.completion_percentage || 0;
  const totalTasks = metrics?.total_tasks || 0;
  const inProgressTasks = metrics?.in_progress_tasks || 0;
  const blockedTasks = metrics?.blocked_tasks || 0;

  const showMenuTrigger = canEditProject || canDeleteProject;
  const statusColor = getStatusColor(project.status);

  return (
    <div
      data-testid="project-card"
      className={cn(
        'relative flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 transition-shadow duration-200 hover:shadow-card',
        menuOpen ? 'z-50' : 'z-0',
      )}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">{icon}</span>
          <div>
            <h3 className="text-[1.1rem] font-semibold text-fg">{project.name}</h3>
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize"
              style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
            >
              {projectStatusLabel(project.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <img
            src={ownerAvatar}
            alt={t('projects.card.ownerAvatarAlt')}
            className="h-8 w-8 rounded-full border-2 border-surface ring-1 ring-border"
          />
          {showMenuTrigger && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label={t('projects.card.actionsAria')}
                aria-expanded={menuOpen}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="flex p-1 text-muted opacity-60 transition-opacity hover:opacity-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
              </button>

              {menuOpen && (
                <div role="menu" className="absolute right-0 top-full z-[60] mt-1 min-w-[168px] overflow-hidden rounded-lg border border-border bg-surface shadow-raised">
                  {canEditProject && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onEdit && onEdit(project); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-fg transition-colors hover:bg-raised"
                    >
                      <span aria-hidden="true">✏️</span> {t('projects.card.edit')}
                    </button>
                  )}
                  {canDeleteProject && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onArchive && onArchive(project); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-status-blocked transition-colors hover:bg-status-blocked/10"
                    >
                      <span aria-hidden="true">📦</span> {t('projects.card.archive')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="line-clamp-2 text-sm leading-relaxed text-muted">{description}</p>

      <div>
        <div className="mb-1.5 flex justify-between text-xs font-medium text-muted">
          <span>{t('projects.card.progress')}</span>
          <span>{completionPercentage}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${completionPercentage}%`, backgroundColor: getProgressColor(completionPercentage) }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-2xl bg-raised px-2.5 py-1 text-[13px] font-medium text-muted">
          <span aria-hidden="true">📋 </span>{t('projects.card.tasksCount', { count: totalTasks })}
        </span>
        <span className="rounded-2xl bg-raised px-2.5 py-1 text-[13px] font-medium text-status-in_progress">
          <span aria-hidden="true">⏳ </span>{t('projects.card.inProgressCount', { count: inProgressTasks })}
        </span>
        {blockedTasks > 0 && (
          <span className="rounded-2xl bg-status-blocked/15 px-2.5 py-1 text-[13px] font-medium text-status-blocked">
            <span aria-hidden="true">🛑 </span>{t('projects.card.blockedCount', { count: blockedTasks })}
          </span>
        )}
      </div>

      <div className="mt-auto flex gap-2 border-t border-hairline pt-4">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/projects/${project.id}`); }}
          className="flex-1 rounded-md border border-border bg-canvas px-4 py-2 text-center text-[13px] font-medium text-fg transition-colors hover:bg-raised"
        >
          {t('projects.card.viewDetail')}
        </button>
        <Link
          data-testid="btn-open-board"
          to={`/projects/${project.id}/board`}
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2 text-center text-[13px] font-medium text-fg transition-colors hover:bg-raised"
        >
          {t('projects.card.viewBoard')}
        </Link>
      </div>
    </div>
  );
};

export default ProjectCard;
