import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NAV_LINKS, SITE_NAME } from "@/utils/constants";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="size-7 text-accent" />
          <span className="font-display text-base font-semibold tracking-tight text-foreground">{SITE_NAME}</span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <MobileNav links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
