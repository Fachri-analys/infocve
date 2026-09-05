import { AlertTriangle, Calendar, ExternalLink, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
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
            <p className="font-medium text-foreground">Tidak Tercantum dalam Katalog CISA KEV</p>
            <p className="text-xs">
              Kerentanan ini saat ini tidak tercantum dalam katalog resmi CISA Known Exploited Vulnerabilities (KEV).
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
            <ShieldAlert className="size-5" />
            Tercantum dalam Katalog CISA KEV
          </CardTitle>
          <span className="rounded-md border border-red-500/30 bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
            TERDAFTAR DALAM KEV
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2 text-sm">
        <p className="text-muted-foreground">
          Berdasarkan catatan resmi CISA (Cybersecurity and Infrastructure Security Agency), kerentanan ini tercantum dalam katalog KEV karena telah terbukti pernah dieksploitasi di alam liar (in the wild). Informasi ini bersumber dari catatan katalog CISA dan bukan merupakan deteksi serangan aktif secara real-time.
        </p>

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-red-500/20 bg-background/60 p-3 sm:grid-cols-2">
          {cisaKev.dateAdded && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-4 shrink-0 text-red-500" />
              <span>
                Tanggal Ditambahkan: <strong className="text-foreground">{formatDateId(cisaKev.dateAdded)}</strong>
              </span>
            </div>
          )}
          {cisaKev.dueDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <span>
                Batas Waktu Remediasi: <strong className="text-foreground">{formatDateId(cisaKev.dueDate)}</strong>
              </span>
            </div>
          )}
        </div>

        {cisaKev.requiredAction && (
          <div className="rounded-lg border border-border bg-surface-hover/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Tindakan Remediasi Resmi CISA</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground">{cisaKev.requiredAction}</p>
          </div>
        )}

        {cisaKev.notes && (
          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-surface/50 p-2.5 text-xs text-muted-foreground">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="leading-relaxed">
              <strong>Catatan CISA:</strong> {cisaKev.notes}
            </p>
          </div>
        )}

        <div className="pt-1 text-xs text-muted-foreground">
          <a
            href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Lihat Katalog Resmi CISA KEV
            <ExternalLink className="size-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
