import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Breadcrumb skeleton */}
      <Skeleton className="mb-4 h-4 w-32" />

      {/* Header skeleton */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      <div className="space-y-8">
        {/* KPI Cards (6 items) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="size-10 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Severity chart card */}
        <Card className="border-border p-6 space-y-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-4 w-full rounded-full" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </Card>

        {/* Priority breakdown card */}
        <Card className="border-border p-6 space-y-4">
          <Skeleton className="h-5 w-72" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        </Card>

        {/* Threat intel summary (2 cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border p-6 space-y-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </Card>
          <Card className="border-border p-6 space-y-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </Card>
        </div>

        {/* Top rankings (3 cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border p-5 space-y-3">
              <Skeleton className="h-5 w-40" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full rounded-md" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
