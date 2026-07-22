import { describe, it, expect } from 'vitest';
import { normalizeApiError, getErrorMessage } from '../client';

describe('normalizeApiError', () => {
  it('extracts code/detail/meta from structured FastAPI envelope', () => {
    const error = {
      message: 'Request failed',
      response: {
        data: {
          detail: {
            code: 'WIP_LIMIT_EXCEEDED',
            detail: 'WIP limit exceeded',
            current_wip: 3,
            limit: 3,
          },
        },
      },
    };

    normalizeApiError(error);

    expect(error.code).toBe('WIP_LIMIT_EXCEEDED');
    expect(error.detail).toBe('WIP limit exceeded');
    expect(error.meta).toEqual({
      code: 'WIP_LIMIT_EXCEEDED',
      detail: 'WIP limit exceeded',
      current_wip: 3,
      limit: 3,
    });
  });

  it('tolerates plain-string detail without crashing', () => {
    const error = {
      message: 'Request failed',
      response: { data: { detail: 'Credenciales incorrectas' } },
    };

    normalizeApiError(error);

    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.detail).toBe('Credenciales incorrectas');
    expect(error.meta).toBeNull();
  });

  it('falls back to error.message when body is missing', () => {
    const error = { message: 'Network Error' };
    normalizeApiError(error);
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.detail).toBe('Network Error');
    expect(error.meta).toBeNull();
  });
});

describe('getErrorMessage', () => {
  it('prefers normalized string detail', () => {
    expect(getErrorMessage({ detail: 'Hola' }, 'fallback')).toBe('Hola');
  });

  it('reads nested envelope detail from raw axios errors', () => {
    const err = {
      response: { data: { detail: { code: 'X', detail: 'Nested' } } },
    };
    expect(getErrorMessage(err)).toBe('Nested');
  });
});
