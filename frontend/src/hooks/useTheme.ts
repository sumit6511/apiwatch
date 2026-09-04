import { useCallback, useState } from "react";

import { applyTheme, getAppliedTheme, setStoredTheme, type Theme } from "../lib/theme";

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(getAppliedTheme);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      setStoredTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
