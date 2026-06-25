import { useTheme } from '../../../store/themeStore';

/**
 * Paletas concretas para Recharts. NO se pueden usar var(--color-*) en props de
 * Recharts (stroke/fill se aplican como atributos SVG, donde var() no resuelve),
 * así que devolvemos hex concretos por tema y dejamos que el cambio de tema
 * re-renderice los charts vía la suscripción a useTheme().
 */
const PALETTES = {
  dark: {
    axis: '#a1a1a1',
    grid: '#2a2a2a',
    cursor: '#1f1f1f',
    surface: '#161616',
    fg: '#ededed',
    muted: '#6b6b6b',
    ideal: '#3f3f46',
    accent: '#818cf8',
  },
  light: {
    axis: '#64748b',
    grid: '#e2e8f0',
    cursor: '#f8fafc',
    surface: '#ffffff',
    fg: '#0f172a',
    muted: '#94a3b8',
    ideal: '#cbd5e1',
    accent: '#6366f1',
  },
};

/**
 * Devuelve la paleta de colores para Recharts según el tema activo.
 * `override` ('light' | 'dark') fuerza una paleta (ej. el PDF del calendario
 * siempre se imprime en claro sin importar el tema de la app).
 */
export function useChartColors(override) {
  const { theme } = useTheme();
  const key = override || theme;
  return PALETTES[key] || PALETTES.dark;
}

/** Estilos del tooltip de Recharts a partir de una paleta. */
export function tooltipStyles(c) {
  return {
    contentStyle: {
      backgroundColor: c.surface,
      borderRadius: 8,
      border: `1px solid ${c.grid}`,
      color: c.fg,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    },
    itemStyle: { fontSize: 13, fontWeight: 500, color: c.fg },
    labelStyle: { fontSize: 13, color: c.muted, marginBottom: 4 },
  };
}

// Clases compartidas del contenedor de cada chart.
export const CHART_CARD = 'h-80 rounded-lg border border-border bg-surface p-5 shadow-soft';
export const CHART_TITLE = 'mb-4 text-[15px] font-semibold text-fg';
export const CHART_EMPTY = 'flex h-[80%] items-center justify-center text-[13px] text-faint';
