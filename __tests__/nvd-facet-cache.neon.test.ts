import { afterAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readNvdFacetSample, writeNvdFacetSample } from "@/lib/nvd-facet-cache";
import type { CVE } from "@/types/cve";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const previousDatabaseUrl = process.env.DATABASE_URL;
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;
const sql = testDatabaseUrl ? neon(testDatabaseUrl) : null;
const cacheKey = "recent-120-days";

describe.skipIf(!testDatabaseUrl)("Neon NVD facet cache integration", () => {
  it("stores a successful sample and can read it back from Neon", async () => {
    await readNvdFacetSample(); // Creates the cache table if this is a fresh test branch.
    const previousRows = await sql!.query(
      "SELECT payload, fetched_at FROM infocve_nvd_facet_cache WHERE cache_key = $1 LIMIT 1",
      [cacheKey]
    ) as Array<{ payload: unknown; fetched_at: Date | string }>;
    const sample = [{
      id: "CVE-2099-1234",
      publishedDate: "2099-01-01T00:00:00.000Z",
      cvss: { baseScore: 7.5 },
    }] as unknown as CVE[];

    try {
      await writeNvdFacetSample(sample);
      await expect(readNvdFacetSample()).resolves.toMatchObject({
        cves: [{ id: "CVE-2099-1234" }],
      });
    } finally {
      const previous = previousRows[0];
      if (previous) {
        await sql!.query(
          `UPDATE infocve_nvd_facet_cache SET payload = $1::jsonb, fetched_at = $2 WHERE cache_key = $3`,
          [JSON.stringify(previous.payload), previous.fetched_at, cacheKey]
        );
      } else {
        await sql!.query("DELETE FROM infocve_nvd_facet_cache WHERE cache_key = $1", [cacheKey]);
      }
    }
  });
});

afterAll(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});
