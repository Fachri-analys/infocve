import { ArrowUpRight, FileSearch } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CveSourceObservation } from "@/types/cve";

const SOURCE_INFO: Record<CveSourceObservation["sourceId"], {
  name: string;
  terms: string;
  termsUrl: string;
  additionalTermsUrl?: string;
  rightsReviewStatus: "TERMS_IDENTIFIED" | "NEEDS_REVIEW";
}> = {
  NVD: {
    name: "National Vulnerability Database (NIST)",
    terms: "Salinan CVE mempertahankan copyright designation dan lisensi MITRE; kontribusi CNA/pihak ketiga dapat memiliki ketentuan tersendiri. This product uses the NVD API but is not endorsed or certified by the NVD.",
    termsUrl: "https://nvd.nist.gov/developers/terms-of-use",
    additionalTermsUrl: "https://www.cve.org/Legal/TermsOfUse",
    rightsReviewStatus: "NEEDS_REVIEW",
  },
  CISA_KEV: {
    name: "CISA Known Exploited Vulnerabilities (KEV)",
    terms: "Data katalog KEV memakai CC0 1.0. Tautan pihak ketiga di dalam katalog tetap mengikuti ketentuannya sendiri.",
    termsUrl: "https://github.com/cisagov/kev-data/blob/develop/LICENSE",
    rightsReviewStatus: "TERMS_IDENTIFIED",
  },
  EPSS: {
    name: "FIRST EPSS / Empirical Security",
    terms: "Skor tersedia gratis dan atribusi diminta. FIRST tidak mencantumkan lisensi dataset EPSS khusus pada FAQ yang ditinjau.",
    termsUrl: "https://www.first.org/epss/faq",
    rightsReviewStatus: "NEEDS_REVIEW",
  },
  GHSA: {
    name: "GitHub Advisory Database",
    terms: "Basis data advisori berlisensi CC BY 4.0. Tautkan record khusus dan tandai perubahan atau ringkasan.",
    termsUrl: "https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#advisory-database",
    rightsReviewStatus: "TERMS_IDENTIFIED",
  },
};

export function CveSourceAttribution({ cveId, observations }: { cveId: string; observations: CveSourceObservation[] }) {
  const sources = observations.length > 0
    ? observations
    : [{ sourceId: "NVD" as const, recordUrl: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`, accessedAt: "" }];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSearch className="size-4 text-accent" aria-hidden="true" />
          Atribusi & ketentuan sumber
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sources.map((observation) => {
          const info = SOURCE_INFO[observation.sourceId];
          return (
            <section key={`${observation.sourceId}-${observation.recordUrl}`} className="border-t border-border pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{info.name}</p>
                  <span className={`mt-1 inline-flex rounded border px-2 py-0.5 text-[10px] font-medium ${info.rightsReviewStatus === "TERMS_IDENTIFIED" ? "border-accent/30 text-accent" : "border-severity-medium/30 text-severity-medium"}`}>{info.rightsReviewStatus === "TERMS_IDENTIFIED" ? "Ketentuan teridentifikasi" : "Needs Review"}</span>
                </div>
                <a href={observation.recordUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent underline-offset-4 hover:underline">
                  Record sumber <ArrowUpRight className="size-3" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{info.terms}</p>
              <a href={info.termsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent underline-offset-4 hover:underline">
                Ketentuan resmi <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
              {info.additionalTermsUrl && <a href={info.additionalTermsUrl} target="_blank" rel="noopener noreferrer" className="ml-4 mt-1 inline-flex items-center gap-1 text-xs text-accent underline-offset-4 hover:underline">CVE Program Terms <ArrowUpRight className="size-3" aria-hidden="true" /></a>}
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {observation.accessedAt
                  ? `Respons diakses InfoCVE ${formatTimestamp(observation.accessedAt)}. Respons NVD/API dapat berasal dari cache; waktu unduh upstream tidak tersedia pada record ini.`
                  : "Waktu akses tidak tercatat pada record ini."}
              </p>
            </section>
          );
        })}
        <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
          CVE® is a registered trademark of The MITRE Corporation. Copyright © The MITRE Corporation; digunakan sesuai <a className="underline underline-offset-2 hover:text-foreground" href="https://www.cve.org/Legal/TermsOfUse" target="_blank" rel="noopener noreferrer">CVE Program Terms of Use</a>.
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          InfoCVE memisahkan data dan rekomendasi sumber eksternal dari terjemahan, prioritas, serta analisis InfoCVE. Penggunaan InfoCVE tidak menunjukkan dukungan atau sertifikasi NVD, CISA, FIRST, maupun GitHub.
        </p>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "waktu tidak diketahui" : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}
