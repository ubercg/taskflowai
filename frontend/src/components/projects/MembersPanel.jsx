import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import api from '../../services/api/client';

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
    () => api.get(`/api/v1/projects/${projectId}/members`).then((res) => res.data),
    { fallbackData: [] },
  );

  const { data: project } = useSWR(
    `/api/v1/projects/${projectId}`,
    () => api.get(`/api/v1/projects/${projectId}`).then((res) => res.data),
  );

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/api/v1/users?search=${encodeURIComponent(search)}`);
        const memberIds = new Set(members.map((m) => m.id || m.user_id));
        setSearchResults(res.data.filter((u) => !memberIds.has(u.id)));
      } catch (err) {
        console.error('Error searching users', err);
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
      setSearch('');
    } catch (err) {
      alert((typeof err.detail === 'string' && err.detail) || err.response?.data?.detail?.detail || 'Error al agregar miembro');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/api/v1/projects/${projectId}/members/${userId}`, { role: newRole });
      mutate();
    } catch (err) {
      alert((typeof err.detail === 'string' && err.detail) || err.response?.data?.detail?.detail || 'Error al cambiar rol');
      mutate();
    }
  };

  const handleRemoveMember = async (userId, name) => {
    if (window.confirm(`¿Seguro que quieres remover a ${name} del proyecto?`)) {
      try {
        await api.delete(`/api/v1/projects/${projectId}/members/${userId}`);
        mutate();
      } catch (err) {
        alert((typeof err.detail === 'string' && err.detail) || err.response?.data?.detail?.detail || 'Error al remover miembro');
      }
    }
  };

  const isOwner = (memberId) => project?.owner_id === memberId;

  return createPortal(
    <>
      <div
        onClick={handleClose}
        className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: isOpen ? 1 : 0 }}
      />
      <div
        className="fixed inset-y-0 right-0 z-[51] flex w-[400px] max-w-full flex-col border-l border-border bg-surface shadow-overlay transition-transform duration-200"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="text-xl font-semibold text-fg">Equipo del Proyecto</h2>
          <button onClick={handleClose} className="text-muted transition-colors hover:text-fg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <h4 className="mb-4 text-[13px] font-semibold uppercase text-muted">Miembros Actuales ({members.length})</h4>
          <div className="flex flex-col gap-4">
            {members.map((member) => {
              const memberId = member.id || member.user_id;
              return (
                <div key={memberId} className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                    style={{ backgroundColor: member.color || 'var(--color-faint)' }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate text-sm font-medium text-fg">
                      {member.name} {isOwner(memberId) && <span className="ml-1 text-[11px] text-priority-high">👑 Owner</span>}
                    </div>
                    <div className="truncate text-xs text-muted">{member.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(memberId, e.target.value)}
                      disabled={isOwner(memberId)}
                      className="rounded border border-border bg-canvas px-2 py-1 text-xs text-fg outline-none disabled:bg-raised disabled:text-muted"
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
                        className="flex p-1 text-status-blocked transition-colors hover:text-status-blocked/80"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <h4 className="mb-4 text-[13px] font-semibold uppercase text-muted">Agregar Miembro</h4>
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-canvas px-3 py-2.5 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
            />

            <div className="mt-3 flex flex-col gap-2">
              {isSearching && <div className="p-2 text-center text-[13px] text-muted">Buscando...</div>}
              {!isSearching && search.trim() && searchResults.length === 0 && (
                <div className="p-2 text-center text-[13px] text-muted">No hay usuarios disponibles.</div>
              )}
              {!isSearching && searchResults.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleAddMember(u.id)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-canvas p-3 transition-colors hover:border-border"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: u.color || 'var(--color-faint)' }}
                  >
                    {getInitials(u.name)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate text-[13px] font-semibold text-fg">{u.name}</div>
                    <div className="truncate text-[11px] text-muted">{u.email} • {u.role}</div>
                  </div>
                  <div className="text-xs font-semibold text-accent">+ Añadir</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

export default MembersPanel;
