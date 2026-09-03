const STORAGE_KEY = "apiwatch_user_token";

// Separate localStorage key and event from lib/accessKey.ts -- the access
// key is a deployment-wide gate, this is a per-account session. They're
// checked independently on the backend (Authorization header vs
// X-User-Token) and can fail independently on the frontend too.
export function getStoredUserToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredUserToken(token: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage unavailable -- app still works, just re-prompts every load.
  }
}

export function clearStoredUserToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See above.
  }
}

export const USER_UNAUTHORIZED_EVENT = "apiwatch:user-unauthorized";
