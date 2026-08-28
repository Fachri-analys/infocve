"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "infocve-theme";
const THEME_EVENT = "infocve-theme-change";

/**
 * Hand-rolled dark/light mode (no next-themes dependency — see README,
 * "Design & architecture decisions"). A tiny blocking script in the root
 * layout sets the initial `.light` class on <html> before paint, so there
 * is no flash of the wrong theme.
 *
 * This hook reads/writes that same external state (the DOM class +
 * localStorage) via `useSyncExternalStore` rather than `useEffect` +
 * `setState`, which is the correct primitive for syncing React to state
 * that lives outside React and can change from multiple places (e.g. the
 * desktop and mobile toggle both mounted at once).
 */
function getSnapshot(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

// Must match what the server (and the pre-hydration script's default) renders.
function getServerSnapshot(): Theme {
  return "dark";
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function applyTheme(next: Theme) {
  document.documentElement.classList.toggle("light", next === "light");
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage blocked/full (e.g. strict private-mode) — the visible theme
    // class above still applies, it just won't persist across reloads.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // True only once mounted on the client — avoids rendering theme-dependent
  // icons before hydration completes, without a setState-in-effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const setTheme = useCallback((next: Theme) => applyTheme(next), []);
  const toggleTheme = useCallback(() => applyTheme(theme === "dark" ? "light" : "dark"), [theme]);

  return { theme, setTheme, toggleTheme, mounted };
}
