import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f8fafc', padding: '24px' }}>
      <div style={{ backgroundColor: '#fff', padding: '48px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 12px 0' }}>Acceso Denegado</h1>
        <p style={{ color: '#64748b', fontSize: '15px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
          No tienes permiso para ver esta sección. Tu rol actual es <strong style={{ color: '#0f172a', textTransform: 'capitalize' }}>{user?.role || 'Desconocido'}</strong>. 
          <br /><br />
          Si crees que esto es un error, contacta al administrador del workspace.
        </p>
        <button 
          onClick={() => navigate(-1)}
          style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'background-color 0.2s' }}
        >
          Volver atrás
        </button>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
