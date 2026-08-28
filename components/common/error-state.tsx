"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { StateMessage } from "@/components/common/state-message";
import { Button } from "@/components/ui/button";

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateMessage
      icon={TriangleAlert}
      tone="critical"
      title="Terjadi kesalahan"
      description="Halaman ini gagal dimuat. Silakan coba lagi; jika masalah berlanjut, kembali ke beranda."
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw />
            Coba lagi
          </Button>
        )
      }
    />
  );
}
