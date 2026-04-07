import React from 'react';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const ROLE_COLORS = {
  admin: { bg: '#f3e8ff', text: '#9333ea' },
  manager: { bg: '#dbeafe', text: '#2563eb' },
  developer: { bg: '#dcfce7', text: '#16a34a' },
  viewer: { bg: '#f1f5f9', text: '#475569' }
};

const UserCard = ({ user, velocity = {} }) => {
  // Manejo de valores si vienen nulos del backend mock
  const role = user.role || 'developer';
  const rColor = ROLE_COLORS[role] || ROLE_COLORS.viewer;
  const uColor = user.color || '#6366f1';
  
  // WIP real bajado del backend
  const wip = velocity.in_progress !== undefined ? velocity.in_progress : 0;
  const wipLimit = 3;
  const wipPercent = Math.min((wip / wipLimit) * 100, 100);
  
  let wipColor = '#22c55e'; // Verde
  if (wip === 2) wipColor = '#eab308'; // Amarillo
  if (wip >= 3) wipColor = '#ef4444'; // Rojo

  const completed = velocity.completed !== undefined ? velocity.completed : 0;
  const totalHours = velocity.total_hours !== undefined ? velocity.total_hours : 0;
  const isActive = user.is_active !== false; // Active por defecto

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', position: 'relative' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: uColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 600, flexShrink: 0 }}>
          {getInitials(user.name)}
        </div>
        
        {isActive && (
          <div style={{ position: 'absolute', top: 0, left: '42px', width: '12px', height: '12px', backgroundColor: '#22c55e', border: '2px solid #fff', borderRadius: '50%', animation: 'pulse-dot 2s infinite' }} />
        )}
        
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {user.name}
          </h3>
          <p style={{ margin: '2px 0 6px 0', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {user.email}
          </p>
          <span style={{ backgroundColor: rColor.bg, color: rColor.text, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
            {role}
          </span>
        </div>
      </div>

      {/* WIP Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
          <span>WIP actual</span>
          <span style={{ color: wip >= 3 ? '#ef4444' : 'inherit' }}>{wip} / {wipLimit}</span>
        </div>
        <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${wipPercent}%`, backgroundColor: wipColor, transition: 'width 0.5s ease, background-color 0.5s' }} />
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{completed}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Completadas</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{wip}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>En Progreso</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{totalHours}h</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Registradas</div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `}</style>
    </div>
  );
};

export default UserCard;
