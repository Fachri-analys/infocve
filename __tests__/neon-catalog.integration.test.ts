import { afterEach, describe, expect, it } from "vitest";
import { createHash, randomInt } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getNeonFacetCounts, searchNeonCves, upsertNeonCves } from "@/lib/db/neon-cve-repository";
import { checkSharedRateLimit, scanRateLimiter } from "@/lib/security/rate-limit";
import { processPendingNeonTranslations } from "@/lib/translation/neon-queue";
import { processPendingNeonCna } from "@/lib/cve/neon-cna-queue";
import type { CVE } from "@/types/cve";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

const testId = `CVE-2099-${randomInt(100_000, 999_999)}`;
const unknownEntityTestId = `CVE-2099-${randomInt(100_000, 999_999)}`;
const description = `InfoCVE Neon integration fixture ${testId}`;
const descriptionHash = createHash("sha256").update(description).digest("hex");
const rateKey = `neon-integration:${testId}`;
const staleTranslationHash = createHash("sha256").update(`stale:${testId}`).digest("hex");

afterEach(async () => {
  if (!testDatabaseUrl) return;
  const sql = neon(testDatabaseUrl);
  await sql.query("DELETE FROM infocve_cves WHERE id = $1", [testId]);
  await sql.query("DELETE FROM infocve_cves WHERE id = $1", [unknownEntityTestId]);
  await sql.query("DELETE FROM infocve_translation_cache WHERE source_hash = $1", [descriptionHash]);
  await sql.query("DELETE FROM infocve_rate_limits WHERE rate_key = $1", [rateKey]);
  await sql.query("DELETE FROM infocve_translation_cache WHERE source_hash = $1", [staleTranslationHash]);
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe.skipIf(!testDatabaseUrl)("Neon catalog integration", () => {
  it("enforces request limits atomically in the shared Neon table", async () => {
    const config = { maxRequests: 1, windowSeconds: 60 };
    await expect(checkSharedRateLimit(rateKey, config, scanRateLimiter)).resolves.toMatchObject({ success: true, remaining: 0 });
    await expect(checkSharedRateLimit(rateKey, config, scanRateLimiter)).resolves.toMatchObject({ success: false, remaining: 0 });
  });

  it("reclaims a translation job left running by a timed-out function", async () => {
    const sql = neon(testDatabaseUrl!);
    await sql.query(`INSERT INTO infocve_translation_cache (source_hash, source_text, status, attempts, updated_at)
      VALUES ($1, 'stale integration test', 'RUNNING', 0, NOW() - INTERVAL '10 minutes')
      ON CONFLICT (source_hash) DO UPDATE SET status = 'RUNNING', attempts = 0, updated_at = NOW() - INTERVAL '10 minutes'`, [staleTranslationHash]);

    const previousUrl = process.env.INFOCVE_TRANSLATION_URL;
    delete process.env.INFOCVE_TRANSLATION_URL;
    try {
      await expect(processPendingNeonTranslations(1, undefined, { concurrency: 1 })).resolves.toEqual({ translated: 0, failed: 1, requests: 0, batches: 0, deferred: 0 });
      const rows = await sql.query("SELECT status FROM infocve_translation_cache WHERE source_hash = $1", [staleTranslationHash]) as Array<{ status: string }>;
      expect(rows[0]?.status).toBe("FAILED");
    } finally {
      if (previousUrl === undefined) delete process.env.INFOCVE_TRANSLATION_URL;
      else process.env.INFOCVE_TRANSLATION_URL = previousUrl;
    }
  });

  it("persists CVEs and returns matching search results and facets from the same catalog", async () => {
    const cve: CVE = {
      id: testId,
      title: `Neon test fixture ${testId}`,
      year: 2099,
      publishedDate: "2099-01-01T00:00:00.000Z",
      lastModifiedDate: "2099-01-01T00:00:00.000Z",
      descriptionEn: description,
      descriptionId: "",
      translationStatus: "PENDING",
      vulnStatus: "Analyzed",
      cvss: null,
      cwe: [{ id: "CWE-79", name: "Cross-site Scripting" }],
      vendor: "InfoCVE Integration",
      product: "Catalog Fixture",
      affected: [],
      references: [],
      category: "unclassified",
      sources: ["NVD"],
    };

    await expect(upsertNeonCves([cve])).resolves.toBe(1);
    const translation = await processPendingNeonTranslations(1, undefined, {
      sourceHashes: [descriptionHash],
      provider: async (texts) => texts.map((text) => text.replace("integration fixture", "uji integrasi")),
    });
    expect(translation).toMatchObject({ translated: 1, failed: 0, requests: 1, batches: 1, deferred: 0 });
    const translationState = await neon(testDatabaseUrl!).query("SELECT description_id, translation_status FROM infocve_cves WHERE id = $1", [testId]) as Array<{ description_id: string; translation_status: string }>;
    expect(translationState[0]).toMatchObject({ description_id: expect.stringContaining("uji integrasi"), translation_status: "TRANSLATED" });

    const search = await searchNeonCves({ query: testId, pageSize: 10 });
    expect(search.total).toBe(1);
    expect(search.results[0]).toMatchObject({ id: testId, vendor: "InfoCVE Integration" });

    const facets = await getNeonFacetCounts({ query: testId });
    expect(facets.vendors).toContainEqual({ value: "InfoCVE Integration", count: 1 });
    expect(facets.products).toContainEqual({ value: "Catalog Fixture", count: 1 });
    expect(facets.cwes).toContainEqual({ id: "CWE-79", name: expect.any(String) });

    await neon(testDatabaseUrl!).query("UPDATE infocve_cves SET vendor = 'Unknown Vendor', product = ' Unknown Product ' WHERE id = $1", [testId]);
    const unknownFacets = await getNeonFacetCounts({ query: testId });
    expect(unknownFacets.vendors).toEqual([]);
    expect(unknownFacets.products).toEqual([]);

    await upsertNeonCves([{ ...cve, id: unknownEntityTestId, title: unknownEntityTestId, vendor: "Unknown Vendor", product: "Unknown Product" }]);
    const cnaJobs = await neon(testDatabaseUrl!).query("SELECT status FROM infocve_cna_queue WHERE cve_id = $1", [unknownEntityTestId]) as Array<{ status: string }>;
    expect(cnaJobs).toEqual([{ status: "PENDING" }]);

    const cnaResult = await processPendingNeonCna(1, undefined, {
      cveIds: [unknownEntityTestId],
      fetcher: async () => Response.json({ containers: { cna: { affected: [{ vendor: "CNA Vendor", product: "CNA Product", versions: [{ version: "1.0.0", status: "affected" }] }] } } }),
    });
    expect(cnaResult).toMatchObject({ processed: 1, enriched: 1, unresolved: 0, failed: 0 });
    const cnaRecord = await neon(testDatabaseUrl!).query("SELECT vendor, product FROM infocve_cves WHERE id = $1", [unknownEntityTestId]) as Array<{ vendor: string; product: string }>;
    expect(cnaRecord).toEqual([{ vendor: "CNA Vendor", product: "CNA Product" }]);
  }, 30_000);
});
