import { CVEDetailSkeleton } from "@/components/common/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CVEDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="navy-panel grid gap-5 border border-border p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-9">
        <div className="space-y-4">
          <Skeleton className="home-hero-skeleton h-3 w-32" />
          <Skeleton className="home-hero-skeleton h-10 w-64 max-w-full" />
          <Skeleton className="home-hero-skeleton h-5 w-full max-w-2xl" />
        </div>
        <Skeleton className="home-hero-skeleton h-14 w-24" />
      </div>
      <Skeleton className="mt-6 h-16 w-full rounded-md" />
      <CVEDetailSkeleton />
    </div>
  );
}
