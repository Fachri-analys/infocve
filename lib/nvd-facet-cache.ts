import "server-only";

import { neon } from "@neondatabase/serverless";
import type { CVE } from "@/types/cve";

export interface CachedFacetSample {
  cves: CVE[];
  fetchedAt: number;
}

const CACHE_KEY = "recent-120-days";

let neonClient: ReturnType<typeof neon> | null = null;
let schemaReady: Promise<void> | null = null;

/** Returns the last successful NVD sample, including stale data for outage fallback. */
export async function readNvdFacetSample(): Promise<CachedFacetSample | null> {
  const sql = getNeonClient();
  if (!sql) return null;

  await ensureSchema(sql);
  const rows = await sql.query(
    `SELECT payload, (EXTRACT(EPOCH FROM fetched_at) * 1000)::bigint AS fetched_at_ms
     FROM infocve_nvd_facet_cache
     WHERE cache_key = $1
     LIMIT 1`,
    [CACHE_KEY]
  ) as Array<{ payload: unknown; fetched_at_ms: number | string }>;
  const row = rows[0];
  if (!row || !isCveArray(row.payload)) return null;

  const fetchedAt = Number(row.fetched_at_ms);
  if (!Number.isFinite(fetchedAt)) return null;
  return { cves: row.payload, fetchedAt };
}

/** Stores a compact successful NVD sample for reuse across Vercel instances and deployments. */
export async function writeNvdFacetSample(cves: CVE[]): Promise<void> {
  const sql = getNeonClient();
  if (!sql) return;

  await ensureSchema(sql);
  await sql.query(
    `INSERT INTO infocve_nvd_facet_cache (cache_key, payload, fetched_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (cache_key) DO UPDATE
     SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
    [CACHE_KEY, JSON.stringify(cves)]
  );
}

function getNeonClient(): ReturnType<typeof neon> | null {
  const connectionString = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!connectionString) return null;
  if (!neonClient) neonClient = neon(connectionString);
  return neonClient;
}

async function ensureSchema(sql: ReturnType<typeof neon>): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql.query(`
      CREATE TABLE IF NOT EXISTS infocve_nvd_facet_cache (
        cache_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function isCveArray(value: unknown): value is CVE[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const cve = item as Partial<CVE>;
    return typeof cve.id === "string" && typeof cve.publishedDate === "string" && !!cve.cvss;
  });
}
