import { useOkrStore } from '../okrStore';

describe('okrStore', () => {
  test('has setObjectives action', () => {
    const state = useOkrStore.getState();
    expect(typeof state.setObjectives).toBe('function');
  });

  test('does NOT have updateProgress action', () => {
    const state = useOkrStore.getState();
    expect(state.updateProgress).toBeUndefined();
  });

  test('setObjectives updates objectives in store', () => {
    const objectives = [{ id: 1, title: 'Goal', progress: 50 }];
    useOkrStore.getState().setObjectives(objectives);
    expect(useOkrStore.getState().objectives).toEqual(objectives);
  });
});
