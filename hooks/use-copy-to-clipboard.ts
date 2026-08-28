"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CopyStatus = "idle" | "copied" | "failed";

/**
 * Copies text to the clipboard and exposes a short-lived status for UI
 * feedback (e.g. swapping an icon for ~1.5s) — including when the write
 * itself fails (e.g. clipboard permission denied, insecure context), so
 * the caller isn't left silently guessing why nothing happened.
 */
export function useCopyToClipboard(resetAfterMs = 1500) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const copy = useCallback(
    async (text: string) => {
      clearTimer();
      let next: CopyStatus;
      try {
        await navigator.clipboard.writeText(text);
        next = "copied";
      } catch {
        next = "failed";
      }
      setStatus(next);
      timeoutRef.current = setTimeout(() => {
        setStatus("idle");
        timeoutRef.current = null;
      }, resetAfterMs);
      return next === "copied";
    },
    [resetAfterMs, clearTimer]
  );

  return { status, copied: status === "copied", failed: status === "failed", copy };
}

