import React, { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../store/authStore';
import api from '../../services/api/client';

const TimeLogWidget = ({ task, onClose, onLogged }) => {
  const { user } = useAuth();
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: logs } = useSWR(
    `/api/v1/time-logs?task_id=${task.id}`,
    () => api.get(`/api/v1/time-logs?task_id=${task.id}`).then(res => res.data)
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const logsToday = logs ? logs.filter(l => l.user_id === user.id && l.log_date === todayStr).reduce((acc, l) => acc + Number(l.hours), 0) : 0;
  
  const currentTotal = Number(task.logged_hours || 0);
  const newTotal = currentTotal + Number(hours || 0);
  const estimated = task.estimated_hours ? Number(task.estimated_hours) : null;
  const isOverEstimated = estimated !== null && newTotal > estimated;

  const handleSubmit = async () => {
    if (!hours || Number(hours) <= 0 || Number(hours) > 16) {
      return alert('Las horas deben ser mayores a 0 y máximo 16');
    }

    setIsSubmitting(true);
    try {
      const newLog = await api.post('/api/v1/time-logs', {
        task_id: task.id,
        user_id: user.id,
        hours: Number(hours),
        description: description || null,
        log_date: date
      }).then(res => res.data);
      
      onLogged(newLog);
      onClose();
    } catch (err) {
      alert("Error al registrar tiempo: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: '100%', right: '0', marginTop: '8px',
      backgroundColor: '#ffffff', borderRadius: '8px', width: '320px',
      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0', zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Registrar tiempo en:</h4>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.title}
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Horas</label>
            <input 
              type="number" step="0.5" min="0.1" max="16" 
              value={hours} onChange={e => setHours(e.target.value)}
              placeholder="0.0"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Fecha</label>
            <input 
              type="date" 
              value={date} onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Descripción</label>
          <input 
            type="text" 
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Actividad realizada..."
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {isOverEstimated && (
          <div style={{ backgroundColor: '#fefce8', color: '#854d0e', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fef08a', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠</span>
            <span>Superarás las horas estimadas ({estimated}h)</span>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Hoy:</span> {logsToday}h
          <span style={{ margin: '0 6px' }}>|</span>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Total:</span> {currentTotal}h {estimated ? `/ ${estimated}h est.` : ''}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={onClose}
            style={{ padding: '6px 12px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', color: '#475569', cursor: 'pointer', fontWeight: 500 }}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!hours || isSubmitting}
            style={{ padding: '6px 12px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: (!hours || isSubmitting) ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: (!hours || isSubmitting) ? 0.7 : 1 }}
          >
            {isSubmitting ? '...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeLogWidget;
