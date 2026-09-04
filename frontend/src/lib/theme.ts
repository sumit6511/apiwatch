export type Theme = "light" | "dark";

const STORAGE_KEY = "apiwatch_theme";

export function getStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode, etc.) -- the toggle still works
    // for this page load, it just won't be remembered next time.
  }
}

/** Reads what index.html's inline script already applied synchronously
 * before first paint, so this can never disagree with what's on screen. */
export function getAppliedTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}
