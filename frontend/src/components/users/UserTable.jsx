import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
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

const UserTable = ({ users, onEdit, onToggle, onViewTasks, onDelete, currentUserId, loading }) => {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const sortedUsers = useMemo(() => {
    const sortableItems = [...users];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [users, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortArrow = (key) => (sortConfig.key === key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '');

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[60px] animate-pulse rounded-lg bg-raised" />
        ))}
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-16 text-center text-muted">{t('users.empty')}</div>
    );
  }

  const th = 'cursor-pointer select-none px-4 py-4 text-[13px] font-semibold text-muted';

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[800px] border-collapse text-left">
        <thead className="border-b border-border bg-raised">
          <tr>
            <th onClick={() => requestSort('name')} className={th}>{t('users.table.name')} {sortArrow('name')}</th>
            <th onClick={() => requestSort('email')} className={th}>{t('users.table.email')} {sortArrow('email')}</th>
            <th onClick={() => requestSort('role')} className={th}>{t('users.table.role')} {sortArrow('role')}</th>
            <th onClick={() => requestSort('is_active')} className={th}>{t('users.table.status')} {sortArrow('is_active')}</th>
            <th className="px-4 py-4 text-[13px] font-semibold text-muted">{t('users.table.wip')}</th>
            <th className="px-4 py-4 text-[13px] font-semibold text-muted">{t('users.table.projects')}</th>
            <th className="px-4 py-4 text-right text-[13px] font-semibold text-muted">{t('users.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((user) => {
            const wip = user.assigned_tasks_count || 0;
            const isWipExceeded = wip >= 3;

            return (
              <tr key={user.id} className={cn('border-b border-hairline transition-colors hover:bg-raised', !user.is_active && 'opacity-50')}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: user.color || '#6366f1' }}>
                      {getInitials(user.name)}
                    </div>
                    <div className="text-sm font-medium text-fg">{user.name}</div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="text-[13px] text-muted">{user.email}</span></td>
                <td className="px-4 py-3">
                  <span data-testid="role-badge" className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', ROLE_BADGE[user.role] || ROLE_BADGE.viewer)}>
                    {userRoleLabel(user.role)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', user.is_active ? 'bg-status-done/15 text-status-done' : 'bg-raised text-muted')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', user.is_active ? 'bg-status-done' : 'bg-faint')} />
                    {user.is_active ? t('users.status.active') : t('users.status.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-[13px]', isWipExceeded ? 'bg-status-blocked/10 font-semibold text-status-blocked' : 'text-muted')}>
                    {wip}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-[13px] text-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    -
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => onEdit(user)} title={t('users.table.edit')} className="p-1 text-muted transition-colors hover:text-fg">
                      <span aria-hidden="true">✏️</span>
                    </button>
                    <button data-testid="btn-view-tasks" onClick={() => onViewTasks(user)} title={t('users.table.viewTasks')} className="p-1 text-muted transition-colors hover:text-fg">
                      <span aria-hidden="true">👁</span>
                    </button>
                    <button
                      data-testid="btn-toggle-user"
                      onClick={() => onToggle(user)}
                      title={user.is_active ? t('users.table.deactivate') : t('users.table.activate')}
                      className="p-1 text-muted transition-colors hover:text-fg"
                    >
                      <span aria-hidden="true">{user.is_active ? '⏸' : '🔄'}</span>
                    </button>
                    {onDelete && user.id !== currentUserId && (
                      <button type="button" data-testid="btn-delete-user" onClick={() => onDelete(user)} title={t('users.table.delete')} className="p-1 text-status-blocked transition-colors hover:text-status-blocked/80">
                        <span aria-hidden="true">🗑</span>
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

export default UserTable;
