import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { createTask } from '../../services/api';
import api from '../../services/api/client';
import { useAuth } from '../../store/authStore';

const PRIORITIES = [
  { id: 'critical', label: 'Crítica', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
  { id: 'high', label: 'Alta', color: '#f97316', bg: '#fff7ed', border: '#fdba74' },
  { id: 'medium', label: 'Media', color: '#eab308', bg: '#fefce8', border: '#fde047' },
  { id: 'low', label: 'Baja', color: '#22c55e', bg: '#f0fdf4', border: '#86efac' },
];

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const TaskFormModal = ({ projectId, defaultStatus = 'backlog', defaultObjectiveId = null, onClose, onCreated }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignee_id: '',
    objective_id: defaultObjectiveId || '',
    due_date: '',
    estimated_hours: '',
    status: defaultStatus,
    type: 'task',
    project_id: projectId
  });

  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [error, setError] = useState(null);
  const [wipWarning, setWipWarning] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch miembros
  const { data: members } = useSWR(
    projectId ? `/api/v1/projects/${projectId}/members` : null,
    () => api.get(`/api/v1/projects/${projectId}/members`).then(res => res.data)
  );

  // Fetch objetivos
  const { data: objectives } = useSWR(
    projectId ? `/api/v1/objectives?project_id=${projectId}` : null,
    () => api.get(`/api/v1/objectives?project_id=${projectId}`).then(res => res.data)
  );

  // Fetch velocity para checkear WIP warning
  const { data: velocities } = useSWR(
    '/api/v1/metrics/velocity',
    () => api.get('/api/v1/metrics/velocity').then(res => res.data),
    { shouldRetryOnError: false }
  );

  // Analizar WIP warning
  useEffect(() => {
    if (formData.status === 'in_progress' && formData.assignee_id && velocities) {
      const userVelocity = velocities.find(v => v.user_id === Number(formData.assignee_id));
      if (userVelocity && userVelocity.in_progress >= 3) {
        setWipWarning('⚠️ Este usuario ya tiene el límite de tareas en progreso (WIP lleno).');
      } else {
        setWipWarning(null);
      }
    } else {
      setWipWarning(null);
    }
  }, [formData.assignee_id, formData.status, velocities]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) return setError('El título es obligatorio');

    const payload = {
      ...formData,
      assignee_id: formData.assignee_id ? Number(formData.assignee_id) : null,
      objective_id: formData.objective_id ? Number(formData.objective_id) : null,
      estimated_hours: formData.estimated_hours ? Number(formData.estimated_hours) : null,
      due_date: formData.due_date || null
    };

    setIsSubmitting(true);
    try {
      const newTask = await createTask(payload);
      onCreated(newTask);
    } catch (err) {
      setError(err.response?.data?.detail || err.detail || 'Error al crear la tarea');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.2s ease-out' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '520px', maxWidth: '90vw', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', animation: 'scaleUp 0.2s ease-out', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Nueva Tarea</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '13px', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        {wipWarning && (
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fff7ed', color: '#c2410c', borderRadius: '6px', fontSize: '13px', border: '1px solid #fed7aa' }}>
            {wipWarning}
          </div>
        )}

        <div style={{ overflowY: 'auto', paddingRight: '8px', flex: 1 }}>
          <form id="task-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Título */}
            <div>
              <input 
                type="text" 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
                autoFocus
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: `1px solid ${error?.includes('título') ? '#ef4444' : '#cbd5e1'}`, fontSize: '16px', fontWeight: 500, outline: 'none', boxSizing: 'border-box' }}
                placeholder="Título de la tarea..."
              />
            </div>

            {/* Asignado & Objetivo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Asignado a</label>
                <select 
                  value={formData.assignee_id}
                  onChange={e => setFormData({...formData, assignee_id: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}
                >
                  <option value="">Sin asignar</option>
                  {members?.map(m => (
                    <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Objetivo (OKR)</label>
                <select 
                  value={formData.objective_id}
                  onChange={e => setFormData({...formData, objective_id: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}
                >
                  <option value="">Sin objetivo</option>
                  {objectives?.map(o => (
                    <option key={o.id} value={o.id}>{o.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prioridad */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Prioridad</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PRIORITIES.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFormData({...formData, priority: p.id})}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: formData.priority === p.id ? `1px solid ${p.border}` : '1px solid #cbd5e1',
                      backgroundColor: formData.priority === p.id ? p.bg : '#f8fafc',
                      color: formData.priority === p.id ? p.color : '#64748b',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.color }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fechas & Estimación */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Fecha Límite</label>
                <input 
                  type="date" 
                  value={formData.due_date} 
                  onChange={e => setFormData({...formData, due_date: e.target.value})} 
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Estimación (hs)</label>
                <input 
                  type="number" 
                  step="0.5"
                  min="0"
                  value={formData.estimated_hours} 
                  onChange={e => setFormData({...formData, estimated_hours: e.target.value})} 
                  placeholder="0.0"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Descripción (Colapsable) */}
            <div>
              {!isDescExpanded ? (
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(true)}
                  style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '13px', fontWeight: 500, cursor: 'pointer', padding: 0 }}
                >
                  + Agregar descripción detallada
                </button>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Descripción</label>
                  <textarea 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', minHeight: '80px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    placeholder="Contexto o requerimientos de la tarea..."
                  />
                </>
              )}
            </div>

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
            form="task-form"
            disabled={isSubmitting} 
            style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 500, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? 'Creando...' : 'Crear Tarea'}
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

export default TaskFormModal;
