const STORAGE_KEY = "apiwatch_access_key";

// Explicit `window.localStorage` rather than the bare global: recent Node
// versions ship their own experimental `localStorage` global that can shadow
// jsdom's implementation in tests, so the bare identifier isn't reliable
// there. `window.localStorage` is unambiguous in both a real browser and
// jsdom.
export function getStoredAccessKey(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessKey(key: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Storage unavailable (private mode, etc.) -- the app still works, it'll
    // just re-prompt every load. Not worth surfacing an error for.
  }
}

export function clearStoredAccessKey(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See above.
  }
}

/** Dispatched by api/client.ts whenever a request comes back 401, so any
 * mounted AccessGate can drop back to the lock screen. */
export const UNAUTHORIZED_EVENT = "apiwatch:unauthorized";
