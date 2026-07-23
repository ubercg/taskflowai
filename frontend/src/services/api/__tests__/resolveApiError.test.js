import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { normalizeApiError, resolveApiError } from '../errors';

describe('resolveApiError', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('translates a known code with meta interpolation in the active locale', () => {
    const error = {
      code: 'WIP_LIMIT_EXCEEDED',
      detail: 'WIP limit exceeded',
      meta: { code: 'WIP_LIMIT_EXCEEDED', detail: 'WIP limit exceeded', current_wip: 3, limit: 3 },
    };

    expect(resolveApiError(error)).toBe(
      'You reached the limit of 3 in-progress tasks (you have 3).',
    );
  });

  it('ignores backend suggestion and uses the catalog message for HAS_ACTIVE_TASKS', () => {
    const error = {
      code: 'HAS_ACTIVE_TASKS',
      detail: 'El usuario tiene tareas activas',
      meta: {
        code: 'HAS_ACTIVE_TASKS',
        detail: 'El usuario tiene tareas activas',
        active_tasks: 2,
        suggestion: 'Reasigna las tareas antes de desactivar',
      },
    };

    expect(resolveApiError(error)).toBe(
      'This user has 2 active tasks. Reassign them before deactivating.',
    );
    expect(resolveApiError(error)).not.toContain('Reasigna');
  });

  it('falls back to detail for unknown codes without breaking (RN-007)', () => {
    const error = {
      code: 'SOME_FUTURE_CODE',
      detail: 'Backend said this',
      meta: { code: 'SOME_FUTURE_CODE', detail: 'Backend said this' },
    };

    expect(resolveApiError(error, 'errors.UNKNOWN_ERROR')).toBe('Backend said this');
  });

  it('uses fallback key when there is no usable detail', async () => {
    await i18n.changeLanguage('es');
    const error = { code: 'UNKNOWN_ERROR', detail: null, meta: null };
    expect(resolveApiError(error, 'errors.LOGIN_FAILED')).toBe('Error al iniciar sesión');
  });

  it('normalizes a raw axios envelope before resolving', async () => {
    await i18n.changeLanguage('es');
    const error = {
      response: {
        data: {
          detail: {
            code: 'AUTH_INVALID_CREDENTIALS',
            detail: 'Credenciales incorrectas',
          },
        },
      },
    };

    expect(resolveApiError(error)).toBe('Credenciales incorrectas');
    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

describe('normalizeApiError (re-export path)', () => {
  it('still extracts code/detail/meta from structured envelope', () => {
    const error = {
      message: 'Request failed',
      response: {
        data: {
          detail: {
            code: 'OPEN_SUBTASKS',
            detail: 'open',
            open_count: 4,
          },
        },
      },
    };

    normalizeApiError(error);
    expect(error.code).toBe('OPEN_SUBTASKS');
    expect(error.meta.open_count).toBe(4);
  });
});
