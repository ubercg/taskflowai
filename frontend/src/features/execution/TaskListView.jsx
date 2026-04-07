import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { getTasks, updateTask, moveTask } from '../../services/api';
import api from '../../services/api/client';
import usePermissions from '../../hooks/usePermissions';

const COL_COLORS = {
  backlog: { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' },
  todo: { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb' },
  in_progress: { bg: '#eef2ff', border: '#a5b4fc', text: '#4f46e5' },
  review: { bg: '#fff7ed', border: '#fdba74', text: '#ea580c' },
  blocked: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
  done: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' }
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const TaskListView = ({ projectId, onOpen }) => {
  const { canMoveTask, canAssignTask, editableFields } = usePermissions();
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterPriority, setFilterPriority] = useState([]);
  const [filterObjective, setFilterObjective] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [massAssigneeId, setMassAssigneeId] = useState('');
  const [massPriority, setMassPriority] = useState('');
  const [isMassUpdating, setIsMassUpdating] = useState(false);
  const { data: tasks, error, isLoading, mutate } = useSWR(
    `/api/v1/tasks?project_id=${projectId}`,
    () => getTasks({ project_id: projectId })
  );

  const { data: members } = useSWR(
    projectId ? `/api/v1/projects/${projectId}/members` : null,
    () => api.get(`/api/v1/projects/${projectId}/members`).then(res => res.data)
  );

  const { data: objectives } = useSWR(
    projectId ? `/api/v1/objectives?project_id=${projectId}` : null,
    () => api.get(`/api/v1/objectives?project_id=${projectId}`).then(res => res.data)
  );

  const togglePriorityFilter = (pri) => {
    if (filterPriority.includes(pri)) {
      setFilterPriority(filterPriority.filter(p => p !== pri));
    } else {
      setFilterPriority([...filterPriority, pri]);
    }
  };

  const handleToggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = (filteredTaskIds) => {
    if (selectedIds.length === filteredTaskIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTaskIds);
    }
  };

  const handleMassUpdate = async () => {
    if (selectedIds.length === 0) return;
    if (!massAssigneeId && !massPriority) return;

    setIsMassUpdating(true);
    try {
      const updates = {};
      if (massAssigneeId) {
        updates.assignee_id = massAssigneeId === 'unassigned' ? null : Number(massAssigneeId);
      }
      if (massPriority) {
        updates.priority = massPriority;
      }

      await Promise.all(selectedIds.map(id => updateTask(id, updates)));
      mutate();
      setSelectedIds([]);
      setMassAssigneeId('');
      setMassPriority('');
    } catch (err) {
      alert("Error en actualización masiva: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsMassUpdating(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await moveTask(task.id, { status: newStatus, position: 0, user_id: 1 /* TODO: del store Auth */ });
      mutate();
    } catch (err) {
      if (err.code === 'WIP_LIMIT_EXCEEDED') {
        const event = new CustomEvent('session-expired', { detail: { type: 'wip', current_wip: err.response?.data?.detail?.current_wip, limit: 3 } }); // Simulamos WIP toast para reuso (aunque deberia ser un toast distinto, usamos window event o alert)
        alert(`WIP Limit alcanzado: ${err.response?.data?.detail?.current_wip}/3`);
      } else {
        alert("Error cambiando estado");
      }
      mutate(); // Revertir visualmente a la DB actual
    }
  };

  const handleAssigneeChange = async (task, newAssigneeId) => {
    const assigneeId = newAssigneeId ? Number(newAssigneeId) : null;
    try {
      // Optimistic update
      mutate(tasks.map(t => t.id === task.id ? { ...t, assignee_id: assigneeId } : t), false);
      await updateTask(task.id, { assignee_id: assigneeId });
      mutate();
    } catch (err) {
      alert("Error al asignar tarea");
      mutate();
    }
  };

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(task => {
      // Filtrar por Asignado
      if (filterAssignee !== 'all') {
        if (filterAssignee === 'unassigned' && task.assignee_id !== null) return false;
        if (filterAssignee !== 'unassigned' && task.assignee_id !== Number(filterAssignee)) return false;
      }
      
      // Filtrar por Prioridad
      if (filterPriority.length > 0 && !filterPriority.includes(task.priority)) {
        return false;
      }
      
      // Filtrar por Objetivo
      if (filterObjective !== 'all') {
        if (filterObjective === 'none' && task.objective_id !== null) return false;
        if (filterObjective !== 'none' && task.objective_id !== Number(filterObjective)) return false;
      }
      
      return true;
    });
  }, [tasks, filterAssignee, filterPriority, filterObjective]);

  const groupedTasks = useMemo(() => {
    if (!filteredTasks) return {};
    return filteredTasks.reduce((acc, task) => {
      const status = task.status || 'backlog';
      if (!acc[status]) acc[status] = [];
      acc[status].push(task);
      return acc;
    }, {});
  }, [filteredTasks]);

  if (isLoading) return <div>Cargando lista de tareas...</div>;
  if (error) return <div>Error cargando tareas.</div>;

  const STATUS_ORDER = ['in_progress', 'blocked', 'review', 'todo', 'backlog', 'done'];

  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      
      {/* Filtros Inline */}
      <div style={{ padding: '16px', display: 'flex', gap: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', alignItems: 'center' }}>
        <select 
          value={filterAssignee} 
          onChange={e => setFilterAssignee(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
        >
          <option value="all">Cualquier Asignado</option>
          <option value="unassigned">Sin asignar</option>
          {members?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        
        <select 
          value={filterObjective} 
          onChange={e => setFilterObjective(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
        >
          <option value="all">Cualquier OKR</option>
          <option value="none">Sin OKR</option>
          {objectives?.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['critical', 'high', 'medium', 'low'].map(p => (
            <button 
              key={p}
              onClick={() => togglePriorityFilter(p)}
              style={{
                padding: '4px 10px',
                borderRadius: '12px',
                border: filterPriority.includes(p) ? '2px solid #6366f1' : '1px solid #cbd5e1',
                backgroundColor: filterPriority.includes(p) ? '#e0e7ff' : '#fff',
                color: filterPriority.includes(p) ? '#4f46e5' : '#475569',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Principal agrupado */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
      {STATUS_ORDER.map(status => {
        const groupTasks = groupedTasks[status];
        if (!groupTasks || groupTasks.length === 0) return null;
        const colorCfg = COL_COLORS[status];

        return (
          <div key={status} style={{ marginBottom: '0' }}>
            {/* Section Header */}
            <div style={{ 
              backgroundColor: colorCfg.bg, 
              borderBottom: '1px solid #e2e8f0', 
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <input 
                type="checkbox" 
                checked={selectedIds.length > 0 && groupTasks.every(t => selectedIds.includes(t.id))}
                onChange={() => handleSelectAll(groupTasks.map(t => t.id))}
                style={{ cursor: 'pointer' }}
              />
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: colorCfg.text, textTransform: 'uppercase' }}>
                {status.replace('_', ' ')}
              </h4>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                ({groupTasks.length})
              </span>
            </div>

            {/* List */}
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                {groupTasks.map(task => {
                  const assignee = members?.find(m => m.id === task.assignee_id);
                  const objective = objectives?.find(o => o.id === task.objective_id);
                  
                  const canEditField = (field) => {
                    const allowedFields = editableFields(task);
                    return allowedFields === 'all' || allowedFields.includes(field);
                  };

                  return (
                  <tr 
                    key={task.id} 
                    style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', width: '4%' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(task.id)}
                        onChange={() => handleToggleSelect(task.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', width: '30%', cursor: 'pointer' }} onClick={() => onOpen(task.id)}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a' }}>
                        {task.title}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', width: '12%' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '12px' }}>
                        {task.priority || 'medium'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', width: '16%' }}>
                      {objective ? (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#5b21b6', backgroundColor: '#ede9fe', padding: '2px 6px', borderRadius: '12px' }}>
                          🎯 {objective.title.length > 20 ? objective.title.substring(0,20)+'...' : objective.title}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Sin OKR</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', width: '15%' }}>
                      <select
                        disabled={!canAssignTask}
                        value={task.assignee_id || 'unassigned'}
                        onChange={(e) => handleAssigneeChange(task, e.target.value)}
                        style={{ 
                          fontSize: '13px', color: '#0f172a', border: '1px solid #e2e8f0', 
                          borderRadius: '6px', padding: '4px', outline: 'none', 
                          backgroundColor: assignee ? assignee.color + '20' : '#f8fafc',
                          cursor: canAssignTask ? 'pointer' : 'not-allowed'
                        }}
                      >
                        <option value="unassigned">— Sin asignar</option>
                        {members?.map(m => (
                          <option key={m.id} value={m.id}>{getInitials(m.name)} {m.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px', width: '15%' }}>
                      <select 
                        disabled={!canEditField('status')}
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: '#fff', cursor: canEditField('status') ? 'pointer' : 'not-allowed' }}
                      >
                        <option value="backlog">Backlog</option>
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Done</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px', width: '10%', textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                        {task.logged_hours || 0}h / {task.estimated_hours || '-'}h
                      </span>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        );
      })}
      </div>
      {selectedIds.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#0f172a', color: '#fff', padding: '16px 24px', borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '24px',
          zIndex: 10, animation: 'slideUp 0.2s ease-out'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{selectedIds.length} tareas seleccionadas</span>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select 
              value={massAssigneeId}
              onChange={e => setMassAssigneeId(e.target.value)}
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
            >
              <option value="" style={{ color: '#000' }}>[Asignar a ▾]</option>
              <option value="unassigned" style={{ color: '#000' }}>Desasignar</option>
              {members?.map(m => <option key={m.id} value={m.id} style={{ color: '#000' }}>{m.name}</option>)}
            </select>

            <select 
              value={massPriority}
              onChange={e => setMassPriority(e.target.value)}
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
            >
              <option value="" style={{ color: '#000' }}>[Cambiar prioridad ▾]</option>
              <option value="critical" style={{ color: '#000' }}>Crítica</option>
              <option value="high" style={{ color: '#000' }}>Alta</option>
              <option value="medium" style={{ color: '#000' }}>Media</option>
              <option value="low" style={{ color: '#000' }}>Baja</option>
            </select>

            <button 
              onClick={handleMassUpdate}
              disabled={isMassUpdating || (!massAssigneeId && !massPriority)}
              style={{ backgroundColor: '#6366f1', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: (!massAssigneeId && !massPriority) ? 'not-allowed' : 'pointer', opacity: (!massAssigneeId && !massPriority) ? 0.5 : 1 }}
            >
              {isMassUpdating ? 'Actualizando...' : 'Aplicar'}
            </button>

            <button 
              onClick={() => { setSelectedIds([]); setMassAssigneeId(''); setMassPriority(''); }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', marginLeft: '8px' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default TaskListView;
