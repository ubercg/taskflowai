import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import api from '../../services/api/client';
import { useAuth } from '../../store/authStore';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const MembersPanel = ({ projectId, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { user: currentUser } = useAuth(); // for checking owner or avoiding removing self if needed

  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200);
  };

  const { data: members, mutate } = useSWR(
    `/api/v1/projects/${projectId}/members`,
    () => api.get(`/api/v1/projects/${projectId}/members`).then(res => res.data),
    { fallbackData: [] }
  );

  const { data: project } = useSWR(
    `/api/v1/projects/${projectId}`,
    () => api.get(`/api/v1/projects/${projectId}`).then(res => res.data)
  );

  // Debounced search
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/api/v1/users?search=${encodeURIComponent(search)}`);
        // Filtrar usuarios que ya son miembros
        const memberIds = new Set(members.map(m => m.id || m.user_id)); // depending on API response shape
        const availableUsers = res.data.filter(u => !memberIds.has(u.id));
        setSearchResults(availableUsers);
      } catch (err) {
        console.error("Error searching users", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, members]);

  const handleAddMember = async (userId) => {
    try {
      await api.post(`/api/v1/projects/${projectId}/members/${userId}`, { role: 'developer' });
      mutate();
      setSearch(''); // clear search after adding
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al agregar miembro');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/api/v1/projects/${projectId}/members/${userId}`, { role: newRole });
      mutate();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al cambiar rol');
      // Revert select visually by re-fetching
      mutate();
    }
  };

  const handleRemoveMember = async (userId, name) => {
    if (window.confirm(`¿Seguro que quieres remover a ${name} del proyecto?`)) {
      try {
        await api.delete(`/api/v1/projects/${projectId}/members/${userId}`);
        mutate();
      } catch (err) {
        alert(err.response?.data?.detail || 'Error al remover miembro');
      }
    }
  };

  const isOwner = (memberId) => project?.owner_id === memberId;

  return (
    <>
      <div 
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 50, opacity: isOpen ? 1 : 0, transition: 'opacity 200ms ease-out'
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '400px', maxWidth: '100vw', backgroundColor: '#ffffff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 51,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease-out',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#0f172a' }}>Equipo del Proyecto</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Current Members */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
            Miembros Actuales ({members.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {members.map(member => {
              const memberId = member.id || member.user_id;
              return (
              <div key={memberId} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: member.color || '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>
                  {getInitials(member.name)}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {member.name} {isOwner(memberId) && <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '4px' }}>👑 Owner</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {member.email}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select 
                    value={member.role}
                    onChange={(e) => handleRoleChange(memberId, e.target.value)}
                    disabled={isOwner(memberId)}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none', backgroundColor: isOwner(memberId) ? '#f8fafc' : '#fff' }}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="developer">Developer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {!isOwner(memberId) && (
                    <button 
                      onClick={() => handleRemoveMember(memberId, member.name)}
                      title="Remover miembro"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
              Agregar Miembro
            </h4>
            <input 
              type="text" 
              placeholder="Buscar por nombre o email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
            
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isSearching && <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '8px' }}>Buscando...</div>}
              {!isSearching && search.trim() && searchResults.length === 0 && (
                <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '8px' }}>No hay usuarios disponibles.</div>
              )}
              {!isSearching && searchResults.map(u => (
                <div 
                  key={u.id} 
                  onClick={() => handleAddMember(u.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', cursor: 'pointer', border: '1px solid transparent', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: u.color || '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                    {getInitials(u.name)}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {u.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {u.email} • {u.role}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600 }}>+ Añadir</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default MembersPanel;
