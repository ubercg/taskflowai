import React, { useState } from 'react';
import useSWR from 'swr';
import { getTasks, createTask, updateTask } from '../../services/api';
import api from '../../services/api/client';
import { Link } from 'react-router-dom';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const ObjectiveTasksPanel = ({ objective, projectId, onClose }) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: tasks, mutate } = useSWR(
    `/api/v1/tasks?project_id=${projectId}&objective_id=${objective.id}`,
    () => api.get(`/api/v1/tasks?project_id=${projectId}`).then(res => res.data.filter(t => t.objective_id === objective.id))
  );

  const { data: members } = useSWR(
    `/api/v1/projects/${projectId}/members`,
    () => api.get(`/api/v1/projects/${projectId}/members`).then(res => res.data)
  );

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await createTask({
        project_id: Number(projectId),
        objective_id: objective.id,
        title: newTaskTitle,
        status: 'backlog',
        type: 'task'
      });
      setNewTaskTitle('');
      mutate();
    } catch (err) {
      alert("Error creando tarea: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssigneeChange = async (taskId, newAssigneeId) => {
    const assigneeId = newAssigneeId ? Number(newAssigneeId) : null;
    try {
      mutate(tasks.map(t => t.id === taskId ? { ...t, assignee_id: assigneeId } : t), false);
      await updateTask(taskId, { assignee_id: assigneeId });
      mutate();
    } catch (err) {
      alert("Error al asignar tarea");
      mutate();
    }
  };

  const doneTasks = tasks ? tasks.filter(t => t.status === 'done').length : 0;
  const totalTasks = tasks ? tasks.length : 0;

  return (
    <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Inline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#6366f1' }}>↳</span> Tareas del OKR
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            {totalTasks > 0 ? `${doneTasks} de ${totalTasks} completadas` : 'Sin tareas aún'}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕ Cerrar panel</button>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!tasks ? (
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>Cargando tareas...</div>
        ) : tasks.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No hay tareas vinculadas a este objetivo.</div>
        ) : (
          tasks.map(task => {
            const isDone = task.status === 'done';
            const assignee = members?.find(m => m.id === task.assignee_id);

            return (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', opacity: isDone ? 0.7 : 1 }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'capitalize', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                    {task.status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a', textDecoration: isDone ? 'line-through' : 'none' }}>
                    {task.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <select
                    value={task.assignee_id || 'unassigned'}
                    onChange={(e) => handleAssigneeChange(task.id, e.target.value)}
                    style={{ 
                      fontSize: '12px', color: '#0f172a', border: '1px solid #e2e8f0', 
                      borderRadius: '6px', padding: '4px', outline: 'none', 
                      backgroundColor: assignee ? assignee.color + '20' : '#f8fafc',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="unassigned">— Sin asignar</option>
                    {members?.map(m => (
                      <option key={m.id} value={m.id}>{getInitials(m.name)} {m.name}</option>
                    ))}
                  </select>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Add Task Form */}
      <form onSubmit={handleCreateTask} style={{ display: 'flex', gap: '8px' }}>
        <input 
          type="text" 
          placeholder="Escribe el título de una nueva tarea para este OKR..." 
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: '#ffffff' }}
        />
        <button 
          type="submit"
          disabled={!newTaskTitle.trim() || isSubmitting}
          style={{ padding: '8px 16px', backgroundColor: '#ffffff', color: '#6366f1', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: (!newTaskTitle.trim() || isSubmitting) ? 'not-allowed' : 'pointer' }}
        >
          {isSubmitting ? '...' : '+ Agregar'}
        </button>
      </form>

      {/* Footer Link */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <Link 
          to={`/projects/${projectId}/board?objective=${objective.id}`}
          style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}
        >
          Ver en Kanban →
        </Link>
      </div>

    </div>
  );
};

export default ObjectiveTasksPanel;
