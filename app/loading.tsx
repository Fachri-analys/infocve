import { CVEGridSkeleton } from "@/components/common/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div>
      <div className="border-b border-border/70 py-2.5">
        <Skeleton className="mx-4 h-4 w-1/3" />
      </div>
      <section className="px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
          <Skeleton className="h-6 w-56 rounded-full" />
          <Skeleton className="h-12 w-full max-w-xl" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-14 w-full max-w-xl rounded-full" />
        </div>
      </section>
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Skeleton className="mb-6 h-6 w-48" />
          <CVEGridSkeleton count={6} />
        </div>
      </section>
    </div>
  );
}
