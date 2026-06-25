import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { format, startOfMonth, addMonths, subMonths } from 'date-fns';
import MonthSelector from '../MonthSelector';

describe('MonthSelector', () => {
  const JUNE_2026 = new Date(2026, 5, 1); // June 1, 2026

  it('muestra el mes y año del valor recibido', () => {
    const onChange = vi.fn();
    render(<MonthSelector value={JUNE_2026} onChange={onChange} />);
    expect(screen.getByText(/junio 2026/i)).toBeInTheDocument();
  });

  it('llama onChange con el mes anterior al hacer clic en el botón anterior', () => {
    const onChange = vi.fn();
    render(<MonthSelector value={JUNE_2026} onChange={onChange} />);

    const prevButton = screen.getByRole('button', { name: /anterior/i });
    fireEvent.click(prevButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    const called = onChange.mock.calls[0][0];
    expect(format(called, 'yyyy-MM')).toBe('2026-05');
  });

  it('llama onChange con el mes siguiente al hacer clic en el botón siguiente', () => {
    const onChange = vi.fn();
    render(<MonthSelector value={JUNE_2026} onChange={onChange} />);

    const nextButton = screen.getByRole('button', { name: /siguiente/i });
    fireEvent.click(nextButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    const called = onChange.mock.calls[0][0];
    expect(format(called, 'yyyy-MM')).toBe('2026-07');
  });

  it('renderiza los botones de navegación', () => {
    const onChange = vi.fn();
    render(<MonthSelector value={JUNE_2026} onChange={onChange} />);

    expect(screen.getByRole('button', { name: /anterior/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeInTheDocument();
  });

  it('muestra el formato correcto para distintos meses', () => {
    const onChange = vi.fn();
    const JAN_2025 = new Date(2025, 0, 1);
    render(<MonthSelector value={JAN_2025} onChange={onChange} />);
    expect(screen.getByText(/enero 2025/i)).toBeInTheDocument();
  });
});
