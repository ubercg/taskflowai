import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from '../../components/kanban/TaskCard';
import usePermissions from '../../hooks/usePermissions';
import Can from '../../components/shared/Can'; // AGREGADO

const COL_COLORS = {
  backlog: '#94a3b8',
  todo: '#60a5fa',
  in_progress: '#818cf8',
  review: '#fb923c',
  blocked: '#f87171',
  done: '#4ade80'
};

const KanbanColumn = ({ columnId, title, tasks = [], wipCount, wipLimit, onTaskClick, onAddTask, bottleneck }) => {
  const { canMoveTask, canCreateTask } = usePermissions();
  const isWipExceeded = columnId === 'in_progress' && wipCount >= wipLimit;
  const isBottleneck = bottleneck?.is_bottleneck;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '280px',
      minWidth: '280px',
      backgroundColor: isBottleneck ? '#fffdfa' : '#f8fafc',
      borderRadius: '8px',
      maxHeight: '100%',
      overflow: 'hidden',
      border: isBottleneck ? '1px solid #fed7aa' : '1px solid #e2e8f0'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 12px',
        borderBottom: `2px solid ${COL_COLORS[columnId] || '#cbd5e1'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: '#ffffff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {title}
            {['backlog', 'todo'].includes(columnId) && (
              <Can permission={canCreateTask}>
                <button
                  onClick={() => onAddTask(columnId)}
                  style={{
                    background: '#e0e7ff', border: 'none', color: '#4f46e5',
                    width: '20px', height: '20px', borderRadius: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0
                  }}
                  title={`Añadir a ${title}`}
                >
                  +
                </button>
              </Can>
            )}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {columnId === 'in_progress' ? (
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                backgroundColor: isWipExceeded ? '#fee2e2' : '#f1f5f9', 
                color: isWipExceeded ? '#ef4444' : '#64748b', 
                padding: '2px 8px', 
                borderRadius: '12px',
                border: isWipExceeded ? '1px solid #fca5a5' : '1px solid transparent'
              }}>
                {wipCount}/{wipLimit}
              </span>
            ) : (
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                backgroundColor: '#f1f5f9', 
                color: '#64748b', 
                padding: '2px 8px', 
                borderRadius: '12px' 
              }}>
                {tasks.length}
              </span>
            )}
          </div>
        </div>
        {isBottleneck && (
          <div 
            data-testid="bottleneck-badge"
            title={`Avg ${bottleneck.avg_hours}h en esta columna (umbral: ${bottleneck.threshold_h}h)`}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '10px',
              padding: '2px 7px',
              borderRadius: '10px',
              backgroundColor: '#fff7ed',
              color: '#c2410c',
              border: '1px solid #fed7aa',
              fontWeight: 500,
              cursor: 'help'
            }}
          >
            <span style={{ fontSize: '12px' }}>⚠</span>
            Aging {Math.round(bottleneck.avg_hours)}h
          </div>
        )}
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            style={{
              padding: '12px',
              flex: 1,
              overflowY: 'auto',
              backgroundColor: snapshot.isDraggingOver ? '#f1f5f9' : (isBottleneck ? 'rgba(255,247,237,0.4)' : 'transparent'),
              transition: 'background-color 0.2s ease',
              minHeight: '100px', // para poder soltar en columnas vacías
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {tasks.map((task, index) => (
              <Draggable 
                key={task.id.toString()} 
                draggableId={task.id.toString()} 
                index={index}
                isDragDisabled={!canMoveTask(task)}
              >
                {(provided, snapshot) => (
                  <TaskCard 
                    task={task} 
                    provided={provided} 
                    isDragging={snapshot.isDragging} 
                    onOpen={onTaskClick}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default KanbanColumn;
