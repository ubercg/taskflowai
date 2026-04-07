import React from 'react';
import { useAuth } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

const ROLE_STYLES = {
  admin: { bg: '#ede9fe', text: '#5b21b6' },
  manager: { bg: '#dbeafe', text: '#1e40af' },
  developer: { bg: '#dcfce7', text: '#166534' },
  viewer: { bg: '#f1f5f9', text: '#475569' }
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const UserMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.viewer;

  return (
    <div style={{
      marginTop: 'auto', // Pushes to the bottom of the flex container (sidebar)
      borderTop: '1px solid #e2e8f0',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      backgroundColor: '#ffffff'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          backgroundColor: user.color || '#6366f1', color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 600, flexShrink: 0
        }}>
          {getInitials(user.name)}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ 
            fontSize: '14px', fontWeight: 600, color: '#0f172a', 
            whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' 
          }}>
            {user.name}
          </div>
          <div style={{ 
            display: 'inline-block', marginTop: '2px',
            backgroundColor: roleStyle.bg, color: roleStyle.text, 
            padding: '2px 6px', borderRadius: '12px', 
            fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' 
          }}>
            {user.role}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => navigate('/profile')}
          style={{
            flex: 1, padding: '6px', fontSize: '12px', color: '#475569',
            backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px'
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#475569'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Ajustes
        </button>
        <button 
          onClick={logout}
          style={{
            flex: 1, padding: '6px', fontSize: '12px', color: '#ef4444',
            backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px',
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px'
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Salir
        </button>
      </div>
    </div>
  );
};

export default UserMenu;
