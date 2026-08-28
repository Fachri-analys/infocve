import type { NextConfig } from "next";

// A single-line, static Content-Security-Policy via next.config.ts headers()
// — deliberately not a per-request nonce (that needs middleware, which is
// out of scope for this pass). 'unsafe-inline' is kept for script-src and
// style-src for two concrete, necessary reasons rather than as a default:
// - script-src: the theme-init script in app/layout.tsx (must run before
//   paint to avoid a flash of the wrong theme) and the JSON-LD block in
//   app/cve/[id]/page.tsx are both inline by design.
// - style-src: Radix UI primitives (Sheet, Accordion) set inline styles and
//   CSS custom properties via JS at runtime for positioning/animation —
//   removing 'unsafe-inline' here would break the mobile nav and the
//   glossary accordion, which is not something this pass should risk
//   without a real browser available to verify against.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // Avoids advertising the framework in responses — a minor fingerprinting
  // reduction, not a real barrier, but a standard, free hardening step.
  poweredByHeader: false,

  // Strips console.log/warn/debug from production client+server bundles.
  // console.error is explicitly kept: lib/nvd.ts relies on it to log real
  // failures server-side even while the app degrades gracefully for users
  // (see docs/API_INTEGRATION.md §7) — losing that would make production
  // issues invisible.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
