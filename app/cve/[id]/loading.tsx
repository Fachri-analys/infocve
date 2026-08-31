import { CVEDetailSkeleton } from "@/components/common/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CVEDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="mt-6 h-16 w-full rounded-2xl" />
      <CVEDetailSkeleton />
    </div>
  );
}
