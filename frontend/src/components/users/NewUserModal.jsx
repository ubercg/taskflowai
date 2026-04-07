import React, { useState } from 'react';
import { createUser } from '../../services/api';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];

const NewUserModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ name: '', email: '', role: 'developer', color: COLORS[0] });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name.trim() || !formData.email.trim()) {
      return setError('Nombre y correo son obligatorios.');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return setError('Formato de correo inválido.');
    }

    setIsSubmitting(true);
    try {
      await createUser(formData);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.detail || 'Error al crear usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '400px', maxWidth: '90vw', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600 }}>Nuevo Usuario</h2>
        
        {error && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '13px' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Nombre completo</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} 
              placeholder="Ej: John Doe" 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Email</label>
            <input 
              type="email" 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} 
              placeholder="john@example.com" 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Rol</label>
            <select 
              value={formData.role} 
              onChange={e => setFormData({...formData, role: e.target.value})} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="developer">Developer</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Color identificador</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {COLORS.map(c => (
                <div 
                  key={c}
                  onClick={() => setFormData({...formData, color: c})}
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    backgroundColor: c, 
                    cursor: 'pointer', 
                    border: formData.color === c ? '2px solid #0f172a' : '2px solid transparent', 
                    transform: formData.color === c ? 'scale(1.1)' : 'scale(1)', 
                    transition: 'all 0.2s' 
                  }}
                />
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 500, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 500, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewUserModal;
