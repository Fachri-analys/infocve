import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

describe("Content Security Policy", () => {
  it("requires a per-request nonce for scripts and excludes unsafe-inline", () => {
    const policy = buildContentSecurityPolicy("test-nonce");
    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
