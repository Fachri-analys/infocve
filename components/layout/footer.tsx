import Link from "next/link";
import { Code2 } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { NAV_LINKS, FOOTER_LINKS, SITE_NAME, SITE_TAGLINE } from "@/utils/constants";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <Logo className="size-6 text-accent" />
              <span className="font-display text-sm font-semibold text-foreground">{SITE_NAME}</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{SITE_TAGLINE}</p>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-foreground">Navigasi</p>
            <ul className="space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-foreground">Legal</p>
            <ul className="space-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/Fachri-analys/infocve"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Code2 className="size-3.5" />
                  Kode Sumber
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border/70 pt-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {SITE_NAME} adalah proyek edukasi independen dan{" "}
            <strong className="text-foreground">tidak berafiliasi</strong> dengan MITRE, NVD (National Vulnerability
            Database), atau CVE Program resmi.{" "}
            <em className="not-italic">
              &ldquo;This product uses the NVD API but is not endorsed or certified by the NVD.&rdquo;
            </em>{" "}
            (Produk ini memakai NVD API, namun tidak didukung atau disertifikasi oleh NVD.) Data CVE diambil
            langsung dari NVD REST API v2.0 resmi. Selalu rujuk sumber resmi seperti{" "}
            <a href="https://nvd.nist.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              nvd.nist.gov
            </a>{" "}
            untuk keputusan keamanan yang sesungguhnya.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            © {year} {SITE_NAME}. Dibuat untuk tujuan edukasi.
          </p>
        </div>
      </div>
    </footer>
  );
}
