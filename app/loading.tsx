import { CVEGridSkeleton } from "@/components/common/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div>
      <section className="home-hero navy-panel border-b border-border" aria-busy="true" aria-label="Memuat beranda">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-20 lg:px-8 lg:py-24">
          <div className="flex max-w-3xl flex-col items-start">
            <Skeleton className="home-hero-skeleton mb-5 h-3 w-52" />
            <Skeleton className="home-hero-skeleton h-12 w-full max-w-2xl sm:h-16" />
            <Skeleton className="home-hero-skeleton mt-6 h-16 w-full max-w-2xl" />
            <Skeleton className="home-hero-skeleton mt-8 h-14 w-full max-w-2xl rounded-lg" />
            <Skeleton className="mt-4 h-4 w-72 max-w-full" />
          </div>
          <div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <Skeleton className="home-hero-skeleton h-3 w-32" />
            <div className="mt-5 divide-y divide-border border-y border-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-4">
                  <Skeleton className="home-hero-skeleton h-4 w-24" />
                  <Skeleton className="home-hero-skeleton h-6 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
          <CVEGridSkeleton count={6} />
        </div>
      </section>
    </div>
  );
}
