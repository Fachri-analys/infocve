import { CalendarPlus, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateId } from "@/utils/format";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  label: string;
  date: string;
  icon: React.ElementType;
}

export function Timeline({ publishedDate, lastModifiedDate }: { publishedDate: string; lastModifiedDate: string }) {
  const events: TimelineEvent[] = [
    { label: "Pertama kali dipublikasikan", date: publishedDate, icon: CalendarPlus },
    { label: "Terakhir diperbarui", date: lastModifiedDate, icon: RefreshCw },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative ml-3 border-l border-border">
          {events.map((event, index) => {
            const Icon = event.icon;
            return (
              <li key={event.label} className={cn("relative pb-6 pl-6 last:pb-0")}>
                <span className="absolute -left-[13px] flex size-6 items-center justify-center rounded-full border border-border bg-background">
                  <Icon className="size-3 text-accent" />
                </span>
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <p className="data-tag text-sm text-muted-foreground">{formatDateId(event.date)}</p>
                {index === events.length - 1 && publishedDate === lastModifiedDate && (
                  <p className="mt-1 text-xs text-muted-foreground">Belum ada perubahan sejak publikasi.</p>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
