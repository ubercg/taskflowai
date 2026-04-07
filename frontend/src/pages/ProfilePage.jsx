import React, { useState } from 'react';
import { useAuth } from '../store/authStore';
import api from '../services/api/client';

const ProfilePage = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      return setError('Las contraseñas nuevas no coinciden');
    }

    try {
      await api.post('/api/v1/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      setMessage('¡Contraseña actualizada con éxito!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || err.detail || 'Error al actualizar contraseña');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#0f172a', marginBottom: '24px', letterSpacing: '-0.02em' }}>
        Mi Perfil
      </h1>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        
        {/* User Info Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%', 
            backgroundColor: user?.color || '#6366f1', color: '#fff', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: '24px', fontWeight: 600, flexShrink: 0 
          }}>
            {user?.name ? user.name.slice(0, 2).toUpperCase() : '??'}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#0f172a' }}>{user?.name}</h2>
            <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b' }}>{user?.email}</p>
            <span style={{ 
              display: 'inline-block', backgroundColor: '#f1f5f9', color: '#475569', 
              padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' 
            }}>
              {user?.role}
            </span>
          </div>
        </div>

        {/* Change Password Form */}
        <div style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>Cambiar Contraseña</h3>
          
          {message && (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', fontSize: '13px', border: '1px solid #bbf7d0' }}>
              {message}
            </div>
          )}

          {error && (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '13px', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Contraseña actual</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Nueva contraseña</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Confirmar nueva contraseña</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button 
              type="submit"
              disabled={!currentPassword || !newPassword || !confirmPassword}
              style={{
                alignSelf: 'flex-start', padding: '10px 20px', borderRadius: '6px', border: 'none',
                backgroundColor: '#6366f1', color: '#fff', fontSize: '14px', fontWeight: 500,
                cursor: 'pointer', marginTop: '8px', opacity: (!currentPassword || !newPassword || !confirmPassword) ? 0.7 : 1
              }}
            >
              Actualizar contraseña
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
