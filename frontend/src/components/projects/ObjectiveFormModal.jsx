import React, { useState, useEffect } from 'react';
import api from '../../services/api/client';
import { toDateInputValue } from '../../utils/dateUtils';

const ObjectiveFormModal = ({ projectId, objective, onClose, onSaved }) => {
  const isEdit = !!objective;
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    progress: 0,
    due_date: '',
    project_id: projectId
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setFormData({
        title: objective.title || '',
        description: objective.description || '',
        progress: objective.progress || 0,
        due_date: objective.due_date ? toDateInputValue(objective.due_date) : '',
        project_id: objective.project_id || projectId
      });
    }
  }, [objective, isEdit, projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) return setError('El título es obligatorio');
    if (!formData.due_date) return setError('La fecha límite es obligatoria');

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/api/v1/objectives/${objective.id}`, formData);
      } else {
        await api.post('/api/v1/objectives', formData);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail || err.detail || 'Error al guardar el objetivo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage < 30) return '#f87171';
    if (percentage <= 70) return '#fb923c';
    return '#4ade80';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.2s ease-out' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '480px', maxWidth: '90vw', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', animation: 'scaleUp 0.2s ease-out' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{isEdit ? 'Editar OKR' : 'Nuevo OKR'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '13px', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        <form id="objective-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Título *</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              placeholder="Ej: Incrementar retención un 20%"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Descripción</label>
            <textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', minHeight: '80px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              <span>Progreso Actual</span>
              <span style={{ color: getProgressColor(formData.progress), fontWeight: 600 }}>{formData.progress}%</span>
            </label>
            <input 
              type="range" 
              min="0" max="100" 
              value={formData.progress} 
              onChange={e => setFormData({...formData, progress: Number(e.target.value)})}
              style={{ width: '100%', margin: '8px 0' }}
            />
            {/* Live Progress Bar */}
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
              <div style={{ height: '100%', width: `${formData.progress}%`, backgroundColor: getProgressColor(formData.progress), transition: 'width 0.2s, background-color 0.2s' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Fecha Límite *</label>
            <input 
              type="date" 
              value={formData.due_date} 
              onChange={e => setFormData({...formData, due_date: e.target.value})} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

        </form>

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
            form="objective-form"
            disabled={isSubmitting} 
            style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 500, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? 'Guardando...' : (isEdit ? 'Guardar OKR' : 'Crear OKR')}
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

export default ObjectiveFormModal;
