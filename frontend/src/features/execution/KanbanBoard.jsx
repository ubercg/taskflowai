import React, { useEffect, useState, useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import useSWR from 'swr';
import { getTasks, moveTask, getBottlenecks } from '../../services/api';
import api from '../../services/api/client';
import { useKanbanStore } from '../../store/kanbanStore';
import { useAuth } from '../../store/authStore';
import KanbanColumn from './KanbanColumn';
import WipToast from './WipToast';

const WIP_LIMIT = 3;

const KanbanBoard = ({ projectId, onTaskClick, onAddTask }) => {
  const { data, error, isLoading } = useSWR(`/api/v1/tasks?project_id=${projectId}`, () => getTasks({ project_id: projectId }));
  
  const { data: bottlenecksData } = useSWR(
    projectId ? `/api/v1/metrics/bottlenecks?project_id=${projectId}` : null,
    () => getBottlenecks(projectId),
    { refreshInterval: 120000 } // Refetch cada 2 min
  );
  
  const bottlenecks = useMemo(() => {
    if (!bottlenecksData) return {};
    return bottlenecksData.reduce((acc, curr) => {
      acc[curr.status] = curr;
      return acc;
    }, {});
  }, [bottlenecksData]);

  useEffect(() => {
    if (projectId) {
      api.post(`/api/v1/metrics/trigger-analysis?project_id=${projectId}`).catch(() => {});
    }
  }, [projectId]);

  const { columns, setColumns, moveTask: moveTaskLocal, revertMove } = useKanbanStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (data) {
      // Si recibimos tasks del backend, armamos las columnas
      const initialCols = {
        backlog: [],
        todo: [],
        in_progress: [],
        review: [],
        blocked: [],
        done: []
      };

      data.forEach(task => {
        if (initialCols[task.status]) {
          initialCols[task.status].push(task);
        }
      });

      // Ordenamos por posición
      Object.keys(initialCols).forEach(key => {
        initialCols[key].sort((a, b) => (a.position || 0) - (b.position || 0));
      });

      setColumns(initialCols);
      setIsInitializing(false);
    }
  }, [data, setColumns]);

  const wipCount = useMemo(() => columns.in_progress.length, [columns.in_progress]);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Snapshot para rollback si falla el endpoint
    const snapshot = JSON.parse(JSON.stringify(columns));

    // Optimistic UI Update
    moveTaskLocal(draggableId, source.droppableId, destination.droppableId, destination.index);

    try {
      await moveTask(draggableId, {
        status: destination.droppableId,
        position: destination.index,
        user_id: user?.id || 1
      });
      // SWR mutará silenciosamente después por regla si hace falta
    } catch (err) {
      // Revertir estado visual
      revertMove(snapshot);
      
      if (err.code === 'WIP_LIMIT_EXCEEDED') {
        const event = new CustomEvent('wip-exceeded', { 
          detail: { 
            current_wip: err.response?.data?.detail?.current_wip || wipCount, 
            limit: WIP_LIMIT 
          } 
        });
        window.dispatchEvent(event);
      } else {
        console.error("Error moviendo tarea:", err);
        alert(err.detail || "Error interno al mover la tarea");
      }
    }
  };

  if (isLoading || isInitializing) return <div>Cargando Tablero Kanban...</div>;
  if (error) return <div>Error cargando tareas</div>;

  return (
    <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '16px', height: '100%', alignItems: 'stretch' }}>
      <WipToast />
      <DragDropContext onDragEnd={onDragEnd}>
        <KanbanColumn columnId="backlog" title="Backlog" tasks={columns.backlog} onTaskClick={onTaskClick} onAddTask={onAddTask} bottleneck={bottlenecks['backlog']} />
        <KanbanColumn columnId="todo" title="To Do" tasks={columns.todo} onTaskClick={onTaskClick} onAddTask={onAddTask} bottleneck={bottlenecks['todo']} />
        <KanbanColumn columnId="in_progress" title="In Progress" tasks={columns.in_progress} wipCount={wipCount} wipLimit={WIP_LIMIT} onTaskClick={onTaskClick} bottleneck={bottlenecks['in_progress']} />
        <KanbanColumn columnId="review" title="Review" tasks={columns.review} onTaskClick={onTaskClick} bottleneck={bottlenecks['review']} />
        <KanbanColumn columnId="blocked" title="Blocked" tasks={columns.blocked} onTaskClick={onTaskClick} bottleneck={bottlenecks['blocked']} />
        <KanbanColumn columnId="done" title="Done" tasks={columns.done} onTaskClick={onTaskClick} bottleneck={bottlenecks['done']} />
      </DragDropContext>
    </div>
  );
};

export default KanbanBoard;
