import React, { useState, useEffect } from 'react';
import api from '../../services/api/client';

const EMOJIS = ['🚀', '🏛️', '🤖', '⚡', '🎯', '💡', '🔧', '📦'];
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const ProjectFormModal = ({ project, onClose, onSaved }) => {
  const isEdit = !!project;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: EMOJIS[0],
    color: COLORS[0],
    start_date: '',
    end_date: '',
    status: 'active'
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        icon: project.icon || EMOJIS[0],
        color: project.color || COLORS[0],
        start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
        end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '',
        status: project.status || 'active'
      });
    }
  }, [project, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      return setError('El nombre es obligatorio');
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        return setError('La fecha fin debe ser posterior al inicio');
      }
    }

    setIsSubmitting(true);
    try {
      let savedProject;
      if (isEdit) {
        const res = await api.patch(`/api/v1/projects/${project.id}`, formData);
        savedProject = res.data;
      } else {
        const res = await api.post('/api/v1/projects', formData);
        savedProject = res.data;
      }
      onSaved(savedProject);
    } catch (err) {
      setError(err.response?.data?.detail || err.detail || 'Error al guardar el proyecto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.2s ease-out' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '520px', maxWidth: '90vw', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', animation: 'scaleUp 0.2s ease-out', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{isEdit ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Live Preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: formData.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
            {formData.icon}
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Preview</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{formData.name || 'Nombre del Proyecto'}</div>
          </div>
        </div>
        
        {error && (
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '13px', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        <div style={{ overflowY: 'auto', paddingRight: '8px', flex: 1 }}>
          <form id="project-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Nombre *</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: `1px solid ${error?.includes('nombre') ? '#ef4444' : '#cbd5e1'}`, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                placeholder="Ej: Lanzamiento V2"
              />
            </div>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                <span>Descripción</span>
                <span style={{ color: '#94a3b8' }}>{formData.description.length}/300</span>
              </label>
              <textarea 
                maxLength={300}
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', minHeight: '80px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                placeholder="Describe el objetivo general..."
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Icono</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {EMOJIS.map(emoji => (
                  <div 
                    key={emoji}
                    onClick={() => setFormData({...formData, icon: emoji})}
                    style={{ 
                      width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                      cursor: 'pointer', borderRadius: '8px', backgroundColor: formData.icon === emoji ? '#e0e7ff' : '#f1f5f9',
                      border: formData.icon === emoji ? '2px solid #6366f1' : '2px solid transparent', transition: 'all 0.2s'
                    }}
                  >
                    {emoji}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Color</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {COLORS.map(c => (
                  <div 
                    key={c}
                    onClick={() => setFormData({...formData, color: c})}
                    style={{ 
                      width: '32px', height: '32px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: formData.color === c ? '2px solid #0f172a' : '2px solid transparent',
                      boxShadow: formData.color === c ? '0 0 0 2px #fff inset' : 'none', transition: 'all 0.2s'
                    }}
                  >
                    {formData.color === c && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Fecha Inicio</label>
                <input 
                  type="date" 
                  value={formData.start_date} 
                  onChange={e => setFormData({...formData, start_date: e.target.value})} 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Fecha Fin estimada</label>
                <input 
                  type="date" 
                  value={formData.end_date} 
                  onChange={e => setFormData({...formData, end_date: e.target.value})} 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {isEdit && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Estado</label>
                <select 
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value})} 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="active">Activo</option>
                  <option value="on_hold">En Pausa</option>
                  <option value="completed">Completado</option>
                  <option value="archived">Archivado</option>
                </select>
              </div>
            )}
          </form>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 500, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="project-form"
            disabled={isSubmitting} 
            style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 500, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Crear Proyecto')}
          </button>
        </div>

      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.97); } to { transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default ProjectFormModal;
