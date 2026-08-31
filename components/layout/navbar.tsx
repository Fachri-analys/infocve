"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NAV_LINKS, SITE_NAME } from "@/utils/constants";

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5" aria-label={`${SITE_NAME}, kembali ke beranda`}>
          <span className="flex size-8 shrink-0 items-center justify-center text-accent transition-colors group-hover:text-foreground">
            <Logo className="size-7" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-semibold tracking-tight text-foreground">{SITE_NAME}</span>
            <span className="hidden text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
              Basis pengetahuan siber
            </span>
          </span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-5 md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "border-b-2 border-accent px-0.5 py-2.5 text-sm font-medium text-foreground"
                  : "border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-border-hover hover:text-foreground"
              }
            >
              {link.label}
            </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <MobileNav links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
