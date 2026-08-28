import { ExternalLink, Link2, ShieldAlert } from "lucide-react";

import type { CVEReference } from "@/types/cve";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSafeUrl } from "@/lib/security";
import { cn } from "@/lib/utils";

/**
 * Only "Exploit" gets distinct (warning-toned) styling — it's the one NVD
 * reference tag that matters most when deciding whether to click through,
 * and it reuses the same severity-high tokens as <Alert variant="warning">
 * elsewhere in the app rather than introducing a new color. Every other
 * official NVD tag (Patch, Vendor Advisory, Third Party Advisory, Mailing
 * List, Release Notes, etc.) — and anything NVD adds to the taxonomy later
 * — falls through to the same neutral chip already used for affected-product
 * versions on the CVE detail page, so nothing ever renders unstyled.
 */
const EXPLOIT_TAG = "Exploit";

function ReferenceTagBadge({ tag }: { tag: string }) {
  const isExploit = tag === EXPLOIT_TAG;
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        isExploit
          ? "border-severity-high/30 bg-severity-high/12 text-severity-high-fg"
          : "border-border bg-background text-muted-foreground"
      )}
    >
      {tag}
    </span>
  );
}

export function ReferenceCard({ references }: { references: CVEReference[] }) {
  if (references.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4 text-accent" />
          Referensi
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {references.map((ref) => {
          const safe = isSafeUrl(ref.url);
          if (!safe) {
            return (
              <div
                key={ref.url}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-hover/30 px-4 py-3 opacity-75"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{ref.source} (Tautan Tidak Aman)</p>
                  <p className="truncate text-xs text-muted-foreground">{ref.url}</p>
                </div>
                <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
              </div>
            );
          }

          return (
            <a
              key={ref.url}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-accent/40 hover:bg-surface-hover"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{ref.source}</p>
                <p className="truncate text-xs text-muted-foreground">{ref.url}</p>
                {ref.tags && ref.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {ref.tags.map((tag) => (
                      <ReferenceTagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                )}
              </div>
              <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent" />
            </a>
          );
        })}
      </CardContent>
    </Card>
  );
}
