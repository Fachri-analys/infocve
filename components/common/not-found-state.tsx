import Link from "next/link";
import { FileSearch } from "lucide-react";

import { StateMessage } from "@/components/common/state-message";
import { Button } from "@/components/ui/button";

export function NotFoundState({
  title = "Halaman tidak ditemukan",
  description = "URL yang Anda tuju tidak ada atau sudah dipindahkan.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <StateMessage
      icon={FileSearch}
      title={title}
      description={description}
      action={
        <Button asChild size="sm">
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
      }
    />
  );
}
