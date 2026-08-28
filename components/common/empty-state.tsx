import { SearchX } from "lucide-react";

import { StateMessage } from "@/components/common/state-message";

export function EmptyState({
  title = "Tidak ada hasil ditemukan",
  description = "Coba ubah kata kunci atau kurangi jumlah filter yang dipakai.",
}: {
  title?: string;
  description?: string;
}) {
  return <StateMessage icon={SearchX} title={title} description={description} />;
}
