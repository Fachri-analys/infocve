import type { Metadata } from "next";

import { NotFoundState } from "@/components/common/not-found-state";

export const metadata: Metadata = {
  title: "Halaman Tidak Ditemukan",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <NotFoundState />
    </div>
  );
}
