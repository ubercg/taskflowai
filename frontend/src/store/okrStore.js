import { create } from 'zustand';

export const useOkrStore = create((set) => ({
  objectives: [],
  loading: false,
  setObjectives: (data) => set({ objectives: data }),
}));
