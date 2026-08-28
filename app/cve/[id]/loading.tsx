import { CVEDetailSkeleton } from "@/components/common/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CVEDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="mb-4 h-4 w-40" />
      <CVEDetailSkeleton />
    </div>
  );
}
