import { Layers } from "lucide-react";

import type { CWEReference } from "@/types/cve";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Only a bare numeric "CWE-###" has a real MITRE definitions page. NVD's own
 *  placeholder values ("NVD-CWE-Other", "NVD-CWE-noinfo" — see lib/cwe-catalog.ts)
 *  aren't real CWE IDs and have no MITRE page to link to. */
const REAL_CWE_ID = /^CWE-\d+$/;

function CWERow({ item }: { item: CWEReference }) {
  const idBadge = (
    <span className="data-tag shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-accent">
      {item.id}
    </span>
  );

  if (!REAL_CWE_ID.test(item.id)) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-hover/40 px-4 py-3">
        <span className="text-sm text-foreground">{item.name}</span>
        {idBadge}
      </div>
    );
  }

  return (
    <a
      href={`https://cwe.mitre.org/data/definitions/${item.id.replace("CWE-", "")}.html`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-hover/40 px-4 py-3 transition-colors hover:border-accent/40 hover:bg-surface-hover"
    >
      <span className="text-sm text-foreground">{item.name}</span>
      {idBadge}
    </a>
  );
}

export function CWECard({ items }: { items: CWEReference[] }) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-4 text-accent" />
          Kategori Kelemahan (CWE)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((item) => (
          <CWERow key={item.id} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}
