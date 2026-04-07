import { create } from 'zustand';

export const useKanbanStore = create((set) => ({
  columns: {
    backlog: [],
    todo: [],
    in_progress: [],
    review: [],
    done: [],
    blocked: []
  },
  loading: false,

  setColumns: (data) => set({ columns: data }),

  moveTask: (taskId, from, to, pos) => set((state) => {
    // Copiamos las columnas de origen y destino para mutar de forma segura
    const sourceCol = [...state.columns[from]];
    const destCol = from === to ? sourceCol : [...state.columns[to]];

    const taskIndex = sourceCol.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return state; // Si no la encuentra, salimos

    // Extraemos la tarea
    const [task] = sourceCol.splice(taskIndex, 1);
    
    // Insertamos en la nueva posición
    destCol.splice(pos, 0, task);

    return {
      columns: {
        ...state.columns,
        [from]: sourceCol,
        [to]: destCol
      }
    };
  }),

  revertMove: (snapshot) => set({ columns: snapshot })
}));
