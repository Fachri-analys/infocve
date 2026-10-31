import { afterEach, describe, expect, it, vi } from "vitest";
import { queryGithubAdvisories } from "@/lib/scanner/github-advisory-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GitHub Security Advisory cross-check", () => {
  it("loads a validated GHSA by its exact identifier and records retrieval time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      ghsa_id: "GHSA-35jh-r3h4-6jhm",
      cve_id: "CVE-2021-23337",
      updated_at: "2025-01-01T00:00:00Z",
      vulnerabilities: [{
        package: { ecosystem: "npm", name: "lodash", purl: "pkg:npm/lodash" },
        vulnerable_version_range: "< 4.17.21",
        first_patched_version: { identifier: "4.17.21" },
      }],
      references: [{ url: "https://lodash.com/blog/security-advisories" }],
    })));

    const result = await queryGithubAdvisories(["GHSA-35jh-r3h4-6jhm"]);

    expect(result.advisories.get("GHSA-35JH-R3H4-6JHM")).toMatchObject({
      cveId: "CVE-2021-23337",
      vulnerabilities: [{ package: { ecosystem: "npm", name: "lodash" }, vulnerableVersionRange: "< 4.17.21", firstPatchedVersion: "4.17.21" }],
    });
    expect(result.advisories.get("GHSA-35JH-R3H4-6JHM")?.fetchedAt).toMatch(/^\d{4}-/);
    expect(result.errors).toEqual([]);
  });

  it("retries transient failures once and never includes token values in errors", async () => {
    vi.stubEnv("GITHUB_TOKEN", "secret-test-token");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("secret-test-token", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ghsa_id: "GHSA-35jh-r3h4-6jhm", vulnerabilities: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await queryGithubAdvisories(["GHSA-35jh-r3h4-6jhm"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.errors).toEqual([]);
    expect(JSON.stringify(result.errors)).not.toContain("secret-test-token");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer secret-test-token" });
  });

  it("ignores invalid identifiers and marks failed lookups incomplete without raw response bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private body", { status: 404 })));

    const result = await queryGithubAdvisories(["not-an-id", "GHSA-35jh-r3h4-6jhm"]);

    expect(result.errors).toEqual(["GitHub Security Advisories lookup failed for GHSA-35JH-R3H4-6JHM (HTTP 404)."]);
    expect(JSON.stringify(result)).not.toContain("private body");
  });
});
