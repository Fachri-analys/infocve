import { CVEGridSkeleton } from "@/components/common/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="h-3 w-44" />
      <Skeleton className="mt-3 h-10 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <Skeleton className="mt-7 h-11 w-full max-w-3xl rounded-2xl" />
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Skeleton className="h-[520px] w-full rounded-2xl" />
        <CVEGridSkeleton count={4} />
      </div>
    </div>
  );
}
