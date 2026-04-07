import React from 'react';

// Helpers para colores e iconos
const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getDueDateStatus = (dueDateStr) => {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const now = new Date();
  
  // Normalizamos a medianoche para comparar solo fechas
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = dueDay - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { color: '#ef4444', bg: '#fee2e2' }; // Vencido (Rojo)
  if (diffDays <= 3) return { color: '#d97706', bg: '#fef3c7' }; // Pronto (Amarillo)
  return { color: '#64748b', bg: '#f1f5f9' }; // Futuro (Gris)
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
};

const TaskCard = ({ task, onMove, onOpen, isDragging, provided }) => {
  // Aseguramos valores por defecto para no romper el render
  const priority = task.priority || 'medium';
  const priorityColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  
  // Cálculo de subtareas
  let subtasksProgress = 0;
  let subtasksDone = 0;
  if (hasSubtasks) {
    subtasksDone = task.subtasks.filter(st => st.status === 'done').length;
    subtasksProgress = (subtasksDone / task.subtasks.length) * 100;
  }

  // Lógica de horas
  const logged = parseFloat(task.logged_hours || 0);
  const estimated = task.estimated_hours ? parseFloat(task.estimated_hours) : null;
  const isOvertime = estimated !== null && logged > estimated;

  // Lógica de fechas
  const dueDateStatus = getDueDateStatus(task.due_date);

  const cardStyle = {
    backgroundColor: '#ffffff',
    borderTop: `1px solid ${isDragging ? '#818cf8' : '#e2e8f0'}`,
    borderRight: `1px solid ${isDragging ? '#818cf8' : '#e2e8f0'}`,
    borderBottom: `1px solid ${isDragging ? '#818cf8' : '#e2e8f0'}`,
    borderLeft: `3px solid ${priorityColor}`,
    borderRadius: '8px',
    padding: '12px',
    boxShadow: isDragging 
      ? '0 8px 24px rgba(0,0,0,0.15)' 
      : '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: 'border-top-color 0.2s, border-right-color 0.2s, border-bottom-color 0.2s, box-shadow 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    position: 'relative',
    userSelect: 'none',
    ...provided?.draggableProps.style,
  };

  return (
    <div 
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      data-testid="task-card"
      style={cardStyle} 
      onClick={() => onOpen && onOpen(task.id)}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderTopColor = '#818cf8';
          e.currentTarget.style.borderRightColor = '#818cf8';
          e.currentTarget.style.borderBottomColor = '#818cf8';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderTopColor = '#e2e8f0';
          e.currentTarget.style.borderRightColor = '#e2e8f0';
          e.currentTarget.style.borderBottomColor = '#e2e8f0';
        }
      }}
    >
      {/* Header: Tags & Priority */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
          {/* OKR Chip */}
          {task.objective_id && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#ede9fe',
              color: '#5b21b6',
              padding: '2px 6px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: 600,
            }}>
              🎯 OKR #{task.objective_id}
            </span>
          )}
          
          {/* Due Date Badge */}
          {task.due_date && dueDateStatus && (
            <span style={{
              backgroundColor: dueDateStatus.bg,
              color: dueDateStatus.color,
              padding: '2px 6px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: 600,
            }}>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>

        {/* Priority Badge */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          marginLeft: '8px',
          flexShrink: 0
        }}>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: priorityColor 
          }} />
          <span style={{ 
            fontSize: '11px', 
            color: '#64748b', 
            fontWeight: 500,
            textTransform: 'capitalize' 
          }}>
            {priority}
          </span>
        </div>
      </div>

      {/* Title */}
      <h4 style={{ 
        margin: '4px 0', 
        fontSize: '14px', 
        fontWeight: 500, 
        color: '#0f172a',
        lineHeight: '1.4',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        wordBreak: 'break-word'
      }}>
        {task.title}
      </h4>

      {/* Footer: Assignee & Hours */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end',
        marginTop: '4px'
      }}>
        {/* Assignee Avatar */}
        {task.assignee ? (
          <div 
            title={task.assignee.name}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: task.assignee.color || '#e2e8f0',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 600,
              boxShadow: '0 0 0 1px #ffffff'
            }}
          >
            {getInitials(task.assignee.name)}
          </div>
        ) : (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#f1f5f9',
            border: '1px dashed #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        )}

        {/* Hours */}
        <div style={{ 
          fontSize: '11px', 
          fontWeight: 500,
          color: isOvertime ? '#ef4444' : '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {isOvertime && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          )}
          {estimated !== null ? (
            <span>{logged}h / {estimated}h</span>
          ) : (
            <span>{logged}h registradas</span>
          )}
        </div>
      </div>

      {/* Subtasks Progress Bar */}
      {hasSubtasks && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: '#f1f5f9',
          borderBottomLeftRadius: '7px',
          borderBottomRightRadius: '7px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${subtasksProgress}%`,
            backgroundColor: subtasksProgress === 100 ? '#22c55e' : (subtasksProgress > 0 ? '#3b82f6' : '#cbd5e1'),
            transition: 'width 0.3s ease, background-color 0.3s ease'
          }} />
        </div>
      )}
    </div>
  );
};

export default TaskCard;
