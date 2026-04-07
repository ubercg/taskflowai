import { create } from 'zustand';

export const useOkrStore = create((set) => ({
  objectives: [],
  loading: false,

  setObjectives: (data) => set({ objectives: data }),

  updateProgress: (id, val) => set((state) => ({
    objectives: state.objectives.map(obj =>
      obj.id === id ? { ...obj, progress: val } : obj
    )
  }))
}));
