import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Selector de mes para el dashboard de métricas.
 *
 * @param {{ value: Date, onChange: (date: Date) => void }} props
 */
const MonthSelector = ({ value, onChange }) => {
  const handlePrev = () => onChange(subMonths(value, 1));
  const handleNext = () => onChange(addMonths(value, 1));

  const label = format(value, 'MMMM yyyy', { locale: es });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <button
        aria-label="Mes anterior"
        onClick={handlePrev}
        style={{
          background: 'none',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '6px 12px',
          cursor: 'pointer',
          color: '#475569',
          fontSize: '16px',
          lineHeight: 1,
        }}
      >
        ‹
      </button>

      <span style={{
        fontSize: '15px',
        fontWeight: 600,
        color: '#0f172a',
        minWidth: '140px',
        textAlign: 'center',
        textTransform: 'capitalize',
      }}>
        {label}
      </span>

      <button
        aria-label="Mes siguiente"
        onClick={handleNext}
        style={{
          background: 'none',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '6px 12px',
          cursor: 'pointer',
          color: '#475569',
          fontSize: '16px',
          lineHeight: 1,
        }}
      >
        ›
      </button>
    </div>
  );
};

export default MonthSelector;
