"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/common/error-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production this is a good place to forward `error` to a logging
    // service. No such service is wired up in this MVP (no analytics), so
    // we just surface it to the console for local debugging.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <ErrorState onRetry={reset} />
    </div>
  );
}
