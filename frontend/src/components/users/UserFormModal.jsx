import React, { useState, useEffect } from 'react';
import { createAdminUser, updateAdminUser } from '../../services/api';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];

const getInitials = (name) => {
  if (!name) return '';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const UserFormModal = ({ user, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'developer',
    color: COLORS[0],
    is_active: true
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        color: user.color,
        is_active: user.is_active
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.name.trim().length < 3) {
      return setError('El nombre debe tener al menos 3 caracteres.');
    }
    
    if (!formData.email.trim()) {
      return setError('El email es obligatorio.');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return setError('Formato de correo inválido.');
    }

    setIsSubmitting(true);
    try {
      if (user) {
        await updateAdminUser(user.id, formData);
      } else {
        await createAdminUser(formData);
      }
      onSaved();
    } catch (err) {
      setError(err.detail || 'Error al guardar el usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = !!user;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.2s ease-out' }}>
      <div data-testid="user-form-modal" style={{ backgroundColor: '#fff', borderRadius: '12px', width: '480px', maxWidth: '90vw', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', animation: 'scaleUp 0.2s ease-out' }}>
        <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 600 }}>{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
        
        {error && (
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '13px', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ 
              width: '56px', height: '56px', borderRadius: '50%', backgroundColor: formData.color, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: '#fff', fontSize: '20px', fontWeight: 600, flexShrink: 0
            }}>
              {getInitials(formData.name) || '??'}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Nombre completo *</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} 
                placeholder="Ej: Jane Doe" 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Email *</label>
            <input 
              type="email" 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} 
              placeholder="jane@example.com" 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Rol de sistema</label>
            <select 
              value={formData.role} 
              onChange={e => setFormData({...formData, role: e.target.value})} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }}
            >
              <option value="admin">⚡ Admin</option>
              <option value="manager">🎯 Manager</option>
              <option value="developer">💻 Developer</option>
              <option value="viewer">👁 Viewer</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Color de Avatar</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {COLORS.map(c => (
                <div 
                  key={c}
                  onClick={() => setFormData({...formData, color: c})}
                  style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: formData.color === c ? '2px solid #0f172a' : '2px solid transparent',
                    boxShadow: formData.color === c ? '0 0 0 2px #fff inset' : 'none'
                  }}
                >
                  {formData.color === c && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 500, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 500, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Crear Usuario')}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.95); } to { transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default UserFormModal;
