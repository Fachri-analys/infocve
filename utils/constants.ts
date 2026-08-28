import type { NavLink, SecurityCategory, CVECategory } from "@/types";

export const SITE_NAME = "InfoCVE";
export const SITE_TAGLINE = "Basis pengetahuan kerentanan siber untuk Indonesia";
export const SITE_DESCRIPTION =
  "InfoCVE membantu siapa pun di Indonesia memahami kerentanan keamanan siber (CVE) dengan bahasa yang sederhana — pencarian CVE, penjelasan CVSS, dan glosarium istilah keamanan.";

export const DEFAULT_PAGE_SIZE = 6;

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Beranda" },
  { href: "/search", label: "Cari CVE" },
  { href: "/sources", label: "Sumber Data" },
  { href: "/glossary", label: "Glosarium" },
  { href: "/about", label: "Tentang" },
];

export const FOOTER_LINKS: NavLink[] = [
  { href: "/privacy", label: "Kebijakan Privasi" },
  { href: "/terms", label: "Syarat & Ketentuan" },
];

export const CATEGORY_META: Record<CVECategory, Omit<SecurityCategory, "slug">> = {
  "web-application": {
    name: "Aplikasi Web",
    descriptionId: "Kerentanan pada situs dan aplikasi yang berjalan di browser.",
  },
  network: {
    name: "Jaringan",
    descriptionId: "Kerentanan pada protokol, layanan, dan perangkat jaringan.",
  },
  "operating-system": {
    name: "Sistem Operasi",
    descriptionId: "Kerentanan pada inti sistem operasi dan komponen bawaannya.",
  },
  "framework-library": {
    name: "Framework & Library",
    descriptionId: "Kerentanan pada framework dan pustaka yang dipakai banyak aplikasi.",
  },
  "enterprise-software": {
    name: "Perangkat Lunak Perusahaan",
    descriptionId: "Kerentanan pada perangkat lunak skala perusahaan dan server.",
  },
  "cloud-infrastructure": {
    name: "Infrastruktur Cloud",
    descriptionId: "Kerentanan pada layanan dan infrastruktur berbasis cloud.",
  },
};

const VALID_CATEGORIES = Object.keys(CATEGORY_META) as CVECategory[];

/** A hand-edited `?category=` shouldn't be able to smuggle in a value CATEGORY_META has no entry for. */
export function isValidCategory(value: string): value is CVECategory {
  return (VALID_CATEGORIES as string[]).includes(value);
}
