import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import {
  getAdminUsers,
  toggleAdminUser,
  deleteAdminUser,
  setAdminUserPassword,
} from '../services/api';
import { resolveApiError } from '../services/api/errors';
import { useAuth } from '../store/authStore';
import UserTable from '../components/users/UserTable';
import UserFormModal from '../components/users/UserFormModal';
import UserTasksDrawer from '../components/users/UserTasksDrawer';
import AssignPasswordModal from '../components/users/AssignPasswordModal';
import { Button } from '../components/ui';
import { userRoleLabel } from '../i18n/enums';

const ROLE_OPTIONS = ['admin', 'manager', 'developer', 'viewer'];

const AdminUsersPage = () => {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [assignPasswordUser, setAssignPasswordUser] = useState(null);

  const queryParams = {};
  if (searchTerm) queryParams.search = searchTerm;
  if (roleFilter) queryParams.role = roleFilter;
  if (activeFilter) queryParams.is_active = activeFilter === 'true';

  const { data, isLoading, mutate } = useSWR(['/api/v1/admin/users', queryParams], () => getAdminUsers(queryParams));

  const handleToggleUser = async (user) => {
    try {
      await toggleAdminUser(user.id);
      mutate();
    } catch (err) {
      alert(resolveApiError(err, 'users.admin.toggleError'));
    }
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(t('users.admin.deleteConfirm', { name: u.name, email: u.email }))) return;
    try {
      await deleteAdminUser(u.id);
      mutate();
    } catch (err) {
      alert(resolveApiError(err, 'users.admin.deleteError'));
    }
  };

  const handleResetPassword = async (u) => {
    if (!window.confirm(t('users.admin.password.resetConfirm', { name: u.name, email: u.email }))) {
      return;
    }
    try {
      await setAdminUserPassword(u.id, { mode: 'reset' });
      alert(t('users.admin.password.resetSuccess', { name: u.name }));
      mutate();
    } catch (err) {
      alert(resolveApiError(err, 'users.admin.password.errors.save'));
    }
  };

  const handleOpenEdit = (user) => { setEditingUser(user); setIsModalOpen(true); };
  const handleOpenCreate = () => { setEditingUser(null); setIsModalOpen(true); };

  const filterSelect = 'rounded-md border border-border bg-canvas px-3 py-2 text-sm text-fg outline-none focus:border-accent';
  const activeCount = data?.active || 0;

  return (
    <div className="mx-auto max-w-[1200px] px-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-fg">{t('users.adminTitle')}</h1>
          <p className="mt-1 text-[15px] text-muted">{t('users.activeCount', { count: activeCount })}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <span className="text-[13px] font-medium text-muted">{t('users.stats.total')}</span>
          <span className="text-2xl font-semibold text-fg">{data?.total || 0}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <span className="text-[13px] font-medium text-muted">{t('users.stats.active')}</span>
          <span className="text-2xl font-semibold text-status-done">{data?.active || 0}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <span className="text-[13px] font-medium text-muted">{t('users.stats.inactive')}</span>
          <span className="text-2xl font-semibold text-faint">{data?.inactive || 0}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <span className="text-[13px] font-medium text-muted">{t('users.stats.admins')}</span>
          <span className="text-2xl font-semibold text-accent">{data?.items?.filter((u) => u.role === 'admin').length || 0}</span>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-surface p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder={t('users.adminSearch.placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-[250px] rounded-md border border-border bg-canvas px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={filterSelect}>
            <option value="">{t('users.filters.allRoles')}</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{userRoleLabel(role)}</option>
            ))}
          </select>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className={filterSelect}>
            <option value="">{t('users.filters.allActive')}</option>
            <option value="true">{t('users.stats.active')}</option>
            <option value="false">{t('users.stats.inactive')}</option>
          </select>
        </div>
        <Button onClick={handleOpenCreate} size="sm">+ {t('users.newUser')}</Button>
      </div>

      <UserTable
        users={data?.items || []}
        onEdit={handleOpenEdit}
        onToggle={handleToggleUser}
        onViewTasks={(user) => setViewingUser(user)}
        onDelete={handleDeleteUser}
        onResetPassword={handleResetPassword}
        onAssignPassword={setAssignPasswordUser}
        currentUserId={authUser?.id}
        loading={isLoading}
      />

      {isModalOpen && (
        <UserFormModal user={editingUser} onClose={() => setIsModalOpen(false)} onSaved={() => { setIsModalOpen(false); mutate(); }} />
      )}

      {assignPasswordUser && (
        <AssignPasswordModal
          user={assignPasswordUser}
          onClose={() => setAssignPasswordUser(null)}
          onSaved={() => {
            setAssignPasswordUser(null);
            alert(t('users.admin.password.assignSuccess', { name: assignPasswordUser.name }));
            mutate();
          }}
        />
      )}

      {viewingUser && <UserTasksDrawer user={viewingUser} onClose={() => setViewingUser(null)} />}
    </div>
  );
};

export default AdminUsersPage;
