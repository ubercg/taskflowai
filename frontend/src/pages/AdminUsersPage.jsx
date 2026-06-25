import { useState } from 'react';
import useSWR from 'swr';
import { getAdminUsers, toggleAdminUser, deleteAdminUser } from '../services/api';
import { useAuth } from '../store/authStore';
import UserTable from '../components/users/UserTable';
import UserFormModal from '../components/users/UserFormModal';
import UserTasksDrawer from '../components/users/UserTasksDrawer';
import { Button } from '../components/ui';

const AdminUsersPage = () => {
  const { user: authUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

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
      const d = err.response?.data?.detail;
      const msg = typeof d === 'string' ? d : d?.detail || (Array.isArray(d) ? d.map((e) => e.msg).join(' ') : JSON.stringify(d));
      alert(msg || 'Error al cambiar el estado del usuario');
    }
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`¿Eliminar permanentemente a "${u.name}" (${u.email})? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteAdminUser(u.id);
      mutate();
    } catch (err) {
      const d = err.response?.data?.detail;
      alert((typeof d === 'string' ? d : err.message) || 'No se pudo eliminar el usuario');
    }
  };

  const handleOpenEdit = (user) => { setEditingUser(user); setIsModalOpen(true); };
  const handleOpenCreate = () => { setEditingUser(null); setIsModalOpen(true); };

  const filterSelect = 'rounded-md border border-border bg-canvas px-3 py-2 text-sm text-fg outline-none focus:border-accent';

  return (
    <div className="mx-auto max-w-[1200px] px-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-fg">Gestión de Usuarios</h1>
          <p className="mt-1 text-[15px] text-muted">{data?.active || 0} usuarios activos en el sistema.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 flex gap-4">
        <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <span className="text-[13px] font-medium text-muted">Total</span>
          <span className="text-2xl font-semibold text-fg">{data?.total || 0}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <span className="text-[13px] font-medium text-muted">Activos</span>
          <span className="text-2xl font-semibold text-status-done">{data?.active || 0}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <span className="text-[13px] font-medium text-muted">Inactivos</span>
          <span className="text-2xl font-semibold text-faint">{data?.inactive || 0}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <span className="text-[13px] font-medium text-muted">Admins</span>
          <span className="text-2xl font-semibold text-accent">{data?.items?.filter((u) => u.role === 'admin').length || 0}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-surface p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-[250px] rounded-md border border-border bg-canvas px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={filterSelect}>
            <option value="">Todos los roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="developer">Developer</option>
            <option value="viewer">Viewer</option>
          </select>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className={filterSelect}>
            <option value="">Todos (Act/Inact)</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <Button onClick={handleOpenCreate} size="sm">+ Nuevo Usuario</Button>
      </div>

      <UserTable
        users={data?.items || []}
        onEdit={handleOpenEdit}
        onToggle={handleToggleUser}
        onViewTasks={(user) => setViewingUser(user)}
        onDelete={handleDeleteUser}
        currentUserId={authUser?.id}
        loading={isLoading}
      />

      {isModalOpen && (
        <UserFormModal user={editingUser} onClose={() => setIsModalOpen(false)} onSaved={() => { setIsModalOpen(false); mutate(); }} />
      )}

      {viewingUser && <UserTasksDrawer user={viewingUser} onClose={() => setViewingUser(null)} />}
    </div>
  );
};

export default AdminUsersPage;
