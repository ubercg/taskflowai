import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { userRoleLabel } from '../../i18n/enums';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const ROLE_BADGE = {
  admin: 'bg-status-review/15 text-status-review',
  manager: 'bg-status-in_progress/15 text-status-in_progress',
  developer: 'bg-status-done/15 text-status-done',
  viewer: 'bg-raised text-muted',
};

const UserCard = ({ user, velocity = {} }) => {
  const { t } = useTranslation();
  const role = user.role || 'developer';
  const uColor = user.color || '#6366f1';

  const wip = velocity.in_progress !== undefined ? velocity.in_progress : 0;
  const wipLimit = 3;
  const wipPercent = Math.min((wip / wipLimit) * 100, 100);

  let wipColor = '#22c55e';
  if (wip === 2) wipColor = '#eab308';
  if (wip >= 3) wipColor = '#ef4444';

  const completed = velocity.completed !== undefined ? velocity.completed : 0;
  const totalHours = velocity.total_hours !== undefined ? velocity.total_hours : 0;
  const isActive = user.is_active !== false;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-soft">
      <div className="relative flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white" style={{ backgroundColor: uColor }}>
          {getInitials(user.name)}
        </div>

        {isActive && (
          <div className="absolute left-[42px] top-0 h-3 w-3 rounded-full border-2 border-surface bg-status-done" style={{ animation: 'pulse-dot 2s infinite' }} />
        )}

        <div className="flex-1 overflow-hidden">
          <h3 className="truncate text-base font-semibold text-fg">{user.name}</h3>
          <p className="mb-1.5 mt-0.5 truncate text-[13px] text-muted">{user.email}</p>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', ROLE_BADGE[role] || ROLE_BADGE.viewer)}>
            {userRoleLabel(role)}
          </span>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-xs font-medium text-muted">
          <span>{t('users.card.wipCurrent')}</span>
          <span className={cn(wip >= 3 && 'text-status-blocked')}>{wip} / {wipLimit}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full transition-all duration-500" style={{ width: `${wipPercent}%`, backgroundColor: wipColor }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
        <div className="flex-1 rounded-md bg-canvas p-2 text-center">
          <div className="text-base font-semibold text-fg">{completed}</div>
          <div className="mt-0.5 text-[11px] text-muted">{t('users.card.completed')}</div>
        </div>
        <div className="flex-1 rounded-md bg-canvas p-2 text-center">
          <div className="text-base font-semibold text-fg">{wip}</div>
          <div className="mt-0.5 text-[11px] text-muted">{t('users.card.inProgress')}</div>
        </div>
        <div className="flex-1 rounded-md bg-canvas p-2 text-center">
          <div className="text-base font-semibold text-fg">{t('users.card.hoursValue', { hours: totalHours })}</div>
          <div className="mt-0.5 text-[11px] text-muted">{t('users.card.logged')}</div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `}</style>
    </div>
  );
};

export default UserCard;
