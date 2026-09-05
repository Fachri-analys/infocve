import path from "path";
import fs from "fs";
import { CREATE_TABLES_SQL } from "./schema";

/**
 * Robust database initialization using Node.js native SQLite (node:sqlite DatabaseSync).
 * Supports in-memory testing and file persistence in data/ directory.
 */

// Define generic Statement and DB types compatible with node:sqlite
export interface StatementSync {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

export interface DatabaseSyncInstance {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  close(): void;
}

let dbInstance: DatabaseSyncInstance | null = null;

export function getDbPath(): string {
  if (process.env.NODE_ENV === "test" && process.env.TEST_DB === "memory") {
    return ":memory:";
  }
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      // ignore
    }
  }
  return path.join(dataDir, "infocve.sqlite");
}

export function getDb(): DatabaseSyncInstance {
  if (dbInstance) {
    return dbInstance;
  }

  // Dynamically require node:sqlite to ensure compatibility
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite");
  const dbPath = getDbPath();
  const db: DatabaseSyncInstance = new DatabaseSync(dbPath);

  // Performance pragmas
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Run schema initialization
  db.exec(CREATE_TABLES_SQL);

  // Seed default data sources if empty
  initDataSources(db);

  dbInstance = db;
  return dbInstance;
}

function initDataSources(db: DatabaseSyncInstance): void {
  const check = db.prepare("SELECT COUNT(*) as count FROM data_sources").get() as { count: number | bigint };
  const count = Number(check?.count ?? 0);
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO data_sources (id, name, type, url, enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    insert.run("NVD", "National Vulnerability Database (NIST)", "NVD", "https://services.nvd.nist.gov/rest/json/cves/2.0", 1, now);
    insert.run("CISA_KEV", "CISA Known Exploited Vulnerabilities", "CISA_KEV", "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", 1, now);
    insert.run("EPSS", "FIRST Exploit Prediction Scoring System", "EPSS", "https://api.first.org/data/v1/epss", 1, now);
    insert.run("GHSA", "GitHub Security Advisories", "GHSA", "https://api.github.com/advisories", 1, now);
  }
}

/** Close database connection (useful for graceful shutdown or tests) */
export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}
