import { AlertTriangle, Calendar, ShieldCheck, ShieldAlert } from "lucide-react";
import type { CisaKevStatus } from "@/types/cve";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateId } from "@/utils/format";

export function CisaKevCard({ cisaKev }: { cisaKev?: CisaKevStatus }) {
  if (!cisaKev || !cisaKev.isKev) {
    return (
      <Card className="border-border/80 bg-surface-hover/20">
        <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <ShieldCheck className="size-5 shrink-0 text-emerald-500" />
          <div>
            <p className="font-medium text-foreground">Tidak Ada di Katalog CISA KEV</p>
            <p className="text-xs">Belum ada bukti eksploitasi aktif terkonfirmasi secara massal dalam katalog CISA KEV.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-red-500">
            <ShieldAlert className="size-5" />
            Peringatan CISA KEV: Dieksploitasi Aktif di Dunia Nyata
          </CardTitle>
          <span className="rounded-md border border-red-500/30 bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
            CISA KEV ACTIVE
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2 text-sm">
        <p className="text-muted-foreground">
          Kerentanan ini telah diverifikasi oleh Badan Keamanan Siber dan Infrastruktur AS (CISA) sedang dieksploitasi secara aktif oleh penyerang siber di lingkungan nyata.
        </p>

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-red-500/20 bg-background/60 p-3 sm:grid-cols-2">
          {cisaKev.dateAdded && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-4 shrink-0 text-red-500" />
              <span>Ditambahkan: <strong className="text-foreground">{formatDateId(cisaKev.dateAdded)}</strong></span>
            </div>
          )}
          {cisaKev.dueDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <span>Batas Waktu Remedi: <strong className="text-foreground">{formatDateId(cisaKev.dueDate)}</strong></span>
            </div>
          )}
        </div>

        {cisaKev.requiredAction && (
          <div className="rounded-lg border border-border bg-surface-hover/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Tindakan Remediasi Wajib</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground">{cisaKev.requiredAction}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
