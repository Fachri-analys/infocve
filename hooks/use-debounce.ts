"use client";

import { useEffect, useState } from "react";

/**
 * Delays updating the returned value until `delayMs` has passed without
 * `value` changing again. Used by the glossary page's client-side filter so
 * we don't re-filter the list on every single keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
