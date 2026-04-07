import React, { useState } from 'react';
import useSWR from 'swr';
import { getUsers, getVelocityMetrics } from '../services/api';
import UserCard from '../components/users/UserCard';
import NewUserModal from '../components/users/NewUserModal';

const UsersPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: users, error, mutate } = useSWR(
    '/api/v1/users', 
    () => getUsers(), 
    { refreshInterval: 30000 }
  );
  
  const { data: velocityData } = useSWR('/api/v1/metrics/velocity', getVelocityMetrics, { refreshInterval: 30000, shouldRetryOnError: false });

  const isLoading = !users && !error;

  // Filtro local
  const filteredUsers = users ? users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const handleUserCreated = () => {
    mutate(); // revalidar users
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Usuarios</h1>
          <p style={{ color: '#64748b', fontSize: '15px', marginTop: '4px' }}>Gestión del equipo y análisis de capacidad (WIP).</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Buscar usuario..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px 12px 8px 34px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', width: '250px' }}
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(99, 102, 241, 0.2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nuevo Usuario
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px', color: '#64748b' }}>Cargando usuarios...</div>
      ) : error ? (
        <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '16px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
          Error al cargar los usuarios. Verifica el backend.
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', color: '#64748b', backgroundColor: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
          No se encontraron usuarios que coincidan con la búsqueda.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {filteredUsers.map(user => {
            const vel = Array.isArray(velocityData) ? velocityData.find(v => v.user_id === user.id || v.name === user.name) : {};
            return <UserCard key={user.id} user={user} velocity={vel || {}} />;
          })}
        </div>
      )}

      {isModalOpen && (
        <NewUserModal onClose={() => setIsModalOpen(false)} onSuccess={handleUserCreated} />
      )}
    </div>
  );
};

export default UsersPage;
