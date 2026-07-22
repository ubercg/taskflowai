import { useTranslation } from 'react-i18next';
import { useAuth } from '../../store/authStore';
import { useTheme } from '../../store/themeStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';
import LanguageSelector from './LanguageSelector';
import { userRoleLabel } from '../../i18n/enums';

const ROLE_BADGE = {
  admin: 'bg-accent-soft text-accent',
  manager: 'bg-status-in_progress/15 text-status-in_progress',
  developer: 'bg-status-done/15 text-status-done',
  viewer: 'bg-raised text-muted',
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /></svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
);

const SECONDARY_BTN =
  'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-canvas ' +
  'px-2 py-1.5 text-xs text-muted transition-colors hover:bg-raised hover:text-fg';

const UserMenu = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  if (!user) return null;

  const isDark = theme === 'dark';

  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: user.color || 'var(--color-accent)' }}
        >
          {getInitials(user.name)}
        </div>
        <div className="overflow-hidden">
          <div className="truncate text-sm font-semibold text-fg">{user.name}</div>
          <span
            className={cn(
              'mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[11px] font-semibold capitalize',
              ROLE_BADGE[user.role] || ROLE_BADGE.viewer,
            )}
          >
            {userRoleLabel(user.role)}
          </span>
        </div>
      </div>

      <LanguageSelector className="w-full justify-center" />

      <button
        onClick={toggleTheme}
        className="flex items-center justify-center gap-2 rounded-lg border border-border bg-canvas px-2 py-1.5 text-xs text-muted transition-colors hover:bg-raised hover:text-fg"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
        {isDark ? t('common.theme.light') : t('common.theme.dark')}
      </button>

      <div className="flex gap-2">
        <button onClick={() => navigate('/profile')} className={SECONDARY_BTN}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          {t('common.actions.settings')}
        </button>
        <button
          onClick={logout}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-status-blocked/40 bg-status-blocked/10 px-2 py-1.5 text-xs text-status-blocked transition-colors hover:bg-status-blocked/20"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          {t('common.actions.logout')}
        </button>
      </div>
    </div>
  );
};

export default UserMenu;
