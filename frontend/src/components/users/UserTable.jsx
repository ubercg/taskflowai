import React, { useState } from 'react';

const ROLE_COLORS = {
  admin: { bg: '#e0e7ff', text: '#4f46e5' }, // indigo
  manager: { bg: '#dbeafe', text: '#2563eb' }, // blue
  developer: { bg: '#dcfce7', text: '#16a34a' }, // green
  viewer: { bg: '#f1f5f9', text: '#475569' } // slate
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const UserTable = ({ users, onEdit, onToggle, onViewTasks, loading }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const sortedUsers = React.useMemo(() => {
    let sortableItems = [...users];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [users, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: '60px', backgroundColor: '#f8fafc', borderRadius: '8px', animation: 'pulse 1.5s infinite ease-in-out' }} />
        ))}
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px', color: '#64748b', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        No se encontraron usuarios.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <tr>
            <th onClick={() => requestSort('name')} style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              Avatar + Nombre {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('email')} style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              Email {sortConfig.key === 'email' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('role')} style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              Rol {sortConfig.key === 'role' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('is_active')} style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
              Estado {sortConfig.key === 'is_active' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
              WIP
            </th>
            <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
              Proyectos
            </th>
            <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map(user => {
            const rColor = ROLE_COLORS[user.role] || ROLE_COLORS.viewer;
            const wip = user.assigned_tasks_count || 0;
            const isWipExceeded = wip >= 3;

            return (
              <tr key={user.id} style={{ 
                borderBottom: '1px solid #f1f5f9',
                transition: 'background-color 0.15s',
                opacity: user.is_active ? 1 : 0.5,
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: user.color || '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                      {getInitials(user.name)}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a' }}>
                      {user.name}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{user.email}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span data-testid="role-badge" style={{ backgroundColor: rColor.bg, color: rColor.text, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    backgroundColor: user.is_active ? '#dcfce7' : '#f1f5f9', 
                    color: user.is_active ? '#16a34a' : '#64748b', 
                    padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: user.is_active ? '#22c55e' : '#94a3b8' }}></span>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ 
                    backgroundColor: isWipExceeded ? '#fef2f2' : 'transparent',
                    color: isWipExceeded ? '#ef4444' : '#475569',
                    padding: '2px 8px', borderRadius: '12px', fontSize: '13px', fontWeight: isWipExceeded ? 600 : 400
                  }}>
                    {wip}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    -
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={() => onEdit(user)} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                      ✏️
                    </button>
                    <button data-testid="btn-view-tasks" onClick={() => onViewTasks(user)} title="Ver tareas" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                      👁
                    </button>
                    <button data-testid="btn-toggle-user" onClick={() => onToggle(user)} title={user.is_active ? 'Desactivar' : 'Activar'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                      {user.is_active ? '⏸' : '🔄'}
                    </button>
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
