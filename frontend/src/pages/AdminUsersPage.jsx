import React, { useState } from 'react';
import useSWR from 'swr';
import { getAdminUsers, toggleAdminUser } from '../services/api';
import UserTable from '../components/users/UserTable';
import UserFormModal from '../components/users/UserFormModal';
import UserTasksDrawer from '../components/users/UserTasksDrawer';

const AdminUsersPage = () => {
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

  const { data, error, isLoading, mutate } = useSWR(
    ['/api/v1/admin/users', queryParams], 
    () => getAdminUsers(queryParams)
  );

  const handleToggleUser = async (user) => {
    try {
      await toggleAdminUser(user.id);
      mutate();
    } catch (err) {
      alert(err.detail?.detail || err.detail || 'Error al cambiar el estado del usuario');
    }
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleViewTasks = (user) => {
    setViewingUser(user);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Gestión de Usuarios</h1>
          <p style={{ color: '#64748b', fontSize: '15px', marginTop: '4px' }}>
            {data?.active || 0} usuarios activos en el sistema.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Total</span>
          <span style={{ fontSize: '24px', fontWeight: 600, color: '#0f172a' }}>{data?.total || 0}</span>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Activos</span>
          <span style={{ fontSize: '24px', fontWeight: 600, color: '#16a34a' }}>{data?.active || 0}</span>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Inactivos</span>
          <span style={{ fontSize: '24px', fontWeight: 600, color: '#94a3b8' }}>{data?.inactive || 0}</span>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Admins</span>
          <span style={{ fontSize: '24px', fontWeight: 600, color: '#4f46e5' }}>
            {data?.items?.filter(u => u.role === 'admin').length || 0}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <input 
            type="text" 
            placeholder="Buscar por nombre o email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', width: '250px' }}
          />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}
          >
            <option value="">Todos los roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="developer">Developer</option>
            <option value="viewer">Viewer</option>
          </select>
          <select 
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}
          >
            <option value="">Todos (Act/Inact)</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <button 
          onClick={handleOpenCreate}
          style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(99, 102, 241, 0.2)' }}
        >
          + Nuevo Usuario
        </button>
      </div>

      <UserTable 
        users={data?.items || []} 
        onEdit={handleOpenEdit} 
        onToggle={handleToggleUser} 
        onViewTasks={handleViewTasks}
        loading={isLoading} 
      />

      {isModalOpen && (
        <UserFormModal 
          user={editingUser} 
          onClose={() => setIsModalOpen(false)} 
          onSaved={() => { setIsModalOpen(false); mutate(); }} 
        />
      )}

      {viewingUser && (
        <UserTasksDrawer user={viewingUser} onClose={() => setViewingUser(null)} />
      )}
    </div>
  );
};

export default AdminUsersPage;
