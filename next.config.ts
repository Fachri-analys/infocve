import type { NextConfig } from "next";

// Per-request nonce CSP is set by proxy.ts. Radix still needs inline styles
// for runtime positioning and CSS custom properties.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // Enables Gzip and Brotli compression for production asset delivery.
  compress: true,

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
