import { afterEach, describe, expect, it, vi } from "vitest";
import { queryOsvPackages } from "@/lib/scanner/osv-client";
import type { DependencyPackage } from "@/lib/scanner/npm-manifest";

afterEach(() => vi.unstubAllGlobals());

const packages: DependencyPackage[] = [
  { name: "alpha", version: "1.0.0", direct: true, transitive: false, locations: ["node_modules/alpha"], declaredRanges: ["^1.0.0"] },
  { name: "beta", version: "2.0.0", direct: false, transitive: true, locations: ["node_modules/alpha/node_modules/beta"], declaredRanges: [] },
];

describe("OSV batch client", () => {
  it("preserves request ordering, follows per-package pagination, and loads advisory details", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ results: [
        { vulns: [{ id: "GHSA-alpha" }], next_page_token: "more-alpha" },
        { vulns: [] },
      ] }))
      .mockResolvedValueOnce(Response.json({ results: [{ vulns: [{ id: "GHSA-alpha-2" }] }] }))
      .mockResolvedValueOnce(Response.json({ id: "GHSA-alpha", aliases: ["CVE-2025-1234"], affected: [] }))
      .mockResolvedValueOnce(Response.json({ id: "GHSA-alpha-2", aliases: [], affected: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await queryOsvPackages(packages);

    expect(result.completedPackages).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.results[0]?.vulnerabilities.map((item) => item.id)).toEqual(["GHSA-alpha", "GHSA-alpha-2"]);
    expect(result.results[1]?.vulnerabilities).toEqual([]);
    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { queries: Array<{ package: { name: string }; page_token: string }> };
    expect(secondRequest.queries).toEqual([{ package: { ecosystem: "npm", name: "alpha" }, version: "1.0.0", page_token: "more-alpha" }]);
  });

  it("reports API failure without fabricating clean results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("offline", { status: 503 })));
    const result = await queryOsvPackages(packages);

    expect(result.completedPackages).toBe(0);
    expect(result.errors).toContain("OSV querybatch gagal (HTTP 503) untuk kelompok dependency 1.");
    expect(result.results.every((item) => item.vulnerabilities.length === 0)).toBe(true);
  });

  it("retries a transient OSV failure once and reports the retry count", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ results: [{ vulns: [] }, { vulns: [] }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await queryOsvPackages(packages);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ completedPackages: 2, errors: [], retryCount: 1 });
  });
});
