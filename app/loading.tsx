import { CVEGridSkeleton } from "@/components/common/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div>
      <div className="border-b border-border/70 py-2.5">
        <Skeleton className="mx-4 h-4 w-1/3" />
      </div>
      <section className="border-b border-border/70 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:gap-16">
          <div className="flex max-w-2xl flex-col gap-4">
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-12 w-full max-w-2xl sm:h-16" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-14 w-full max-w-2xl rounded-2xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
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
