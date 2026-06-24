import '@testing-library/jest-dom';

// jsdom no implementa ResizeObserver, que Recharts (ResponsiveContainer) necesita.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
