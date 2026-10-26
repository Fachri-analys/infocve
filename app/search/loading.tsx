import { CVEGridSkeleton } from "@/components/common/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <Skeleton className="mb-4 h-4 w-32" />
      <section className="editorial-panel navy-panel -mx-4 mb-10 border-y border-border sm:mx-0 sm:border" aria-busy="true" aria-label="Memuat pencarian">
        <div className="relative grid gap-8 px-4 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12 lg:px-10 lg:py-12">
          <div>
            <Skeleton className="home-hero-skeleton mb-5 h-3 w-52" />
            <Skeleton className="home-hero-skeleton h-14 w-full max-w-2xl sm:h-20" />
            <Skeleton className="home-hero-skeleton mt-5 h-10 w-full max-w-xl" />
            <Skeleton className="home-hero-skeleton mt-4 h-12 w-full max-w-3xl" />
          </div>
          <div className="grid grid-cols-2 gap-5 border-t border-border pt-5 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <Skeleton className="home-hero-skeleton h-20 w-full" />
            <Skeleton className="home-hero-skeleton h-20 w-full" />
          </div>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
        <div className="border-t-4 border-t-accent">
          <Skeleton className="h-[520px] w-full" />
        </div>
        <section aria-label="Memuat hasil pencarian">
          <div className="mb-5 border-b border-border pb-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-7 w-64 max-w-full" />
          </div>
          <CVEGridSkeleton count={4} />
        </section>
      </div>
    </div>
  );
}
