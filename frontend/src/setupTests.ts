import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement localStorage by default (window.localStorage is
// undefined), unlike a real browser. Polyfill it with a minimal in-memory
// Storage so code under test (src/lib/accessKey.ts) behaves the same way
// here as it does in the browser.
if (typeof window !== "undefined" && !window.localStorage) {
  let store = new Map<string, string>();
  const memoryStorage: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store = new Map();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
}
