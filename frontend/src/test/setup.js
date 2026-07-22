import '@testing-library/jest-dom';

// jsdom no implementa ResizeObserver, que Recharts (ResponsiveContainer) necesita.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// En este entorno `localStorage` existe como objeto vacío: no expone getItem,
// setItem ni removeItem. Sin esto, cualquier store con `persist` de zustand
// (p. ej. localeStore) no se puede verificar en tests.
if (typeof globalThis.localStorage?.getItem !== 'function') {
  const store = new Map();
  const localStorageMock = {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
  if (globalThis.window) {
    Object.defineProperty(globalThis.window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
  }
}
