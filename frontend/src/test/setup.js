import '@testing-library/jest-dom';

import i18n from '../i18n';

// Tests look keys up with i18n.t(...) so copy edits do not break them. The
// catch is that the component and the assertion resolve the SAME key through
// the SAME catalogue: when a key is missing, i18next returns the key itself on
// both sides, they match, and the test passes while the UI renders a raw key
// like `users.form.createTitle` as visible text.
//
// Throwing here breaks that symmetry — the failure happens at lookup, inside
// the component render, before there are two sides to compare. Catalogue
// parity does not cover this: a typo such as t('users.form.creatTitle') exists
// in neither locale, so es/en stay in sync while the screen is broken.
i18n.options.parseMissingKeyHandler = (key) => {
  throw new Error(
    `Missing i18n key: "${key}". Add it to src/i18n/locales/{es,en}.json, ` +
      'or fix the key name in the component.',
  );
};

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
