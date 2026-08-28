/**
 * InfoCVE Database Schema Definitions
 * Powered by native SQLite (node:sqlite) for zero-dependency, ultra-fast embedded storage.
 */

export const CREATE_TABLES_SQL = `
-- CVE core table
CREATE TABLE IF NOT EXISTS cves (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_id TEXT NOT NULL,
  published_date TEXT NOT NULL,
  last_modified_date TEXT NOT NULL,
  vendor TEXT NOT NULL,
  product TEXT NOT NULL,
  category TEXT NOT NULL,
  year INTEGER NOT NULL,
  cvss_version TEXT NOT NULL,
  cvss_score REAL NOT NULL,
  cvss_severity TEXT NOT NULL,
  cvss_vector TEXT NOT NULL,
  epss_score REAL,
  epss_percentile REAL,
  cisa_kev_flag INTEGER DEFAULT 0,
  cisa_date_added TEXT,
  cisa_due_date TEXT,
  cisa_required_action TEXT,
  has_poc INTEGER DEFAULT 0,
  sources_json TEXT NOT NULL DEFAULT '["NVD"]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexing for fast search and filtering
CREATE INDEX IF NOT EXISTS idx_cves_published_date ON cves (published_date DESC);
CREATE INDEX IF NOT EXISTS idx_cves_last_modified_date ON cves (last_modified_date DESC);
CREATE INDEX IF NOT EXISTS idx_cves_year ON cves (year DESC);
CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves (cvss_severity);
CREATE INDEX IF NOT EXISTS idx_cves_score ON cves (cvss_score DESC);
CREATE INDEX IF NOT EXISTS idx_cves_vendor ON cves (vendor);
CREATE INDEX IF NOT EXISTS idx_cves_product ON cves (product);
CREATE INDEX IF NOT EXISTS idx_cves_category ON cves (category);
CREATE INDEX IF NOT EXISTS idx_cves_cisa_kev ON cves (cisa_kev_flag);
CREATE INDEX IF NOT EXISTS idx_cves_has_poc ON cves (has_poc);

-- Affected products table
CREATE TABLE IF NOT EXISTS cve_affected (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cve_id TEXT NOT NULL,
  vendor TEXT NOT NULL,
  product TEXT NOT NULL,
  versions_json TEXT NOT NULL,
  FOREIGN KEY (cve_id) REFERENCES cves (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cve_affected_cve ON cve_affected (cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_affected_vp ON cve_affected (vendor, product);

-- Weaknesses (CWE) table
CREATE TABLE IF NOT EXISTS cve_cwes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cve_id TEXT NOT NULL,
  cwe_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (cve_id) REFERENCES cves (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cve_cwes_cve ON cve_cwes (cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_cwes_cwe_id ON cve_cwes (cwe_id);

-- References table
CREATE TABLE IF NOT EXISTS cve_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cve_id TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  is_exploit INTEGER DEFAULT 0,
  is_poc INTEGER DEFAULT 0,
  FOREIGN KEY (cve_id) REFERENCES cves (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cve_refs_cve ON cve_references (cve_id);

-- Data sources status table
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_sync_at TEXT,
  sync_status TEXT DEFAULT 'idle',
  total_records INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

-- Provenance tracking table (audit log of where each data point originated)
CREATE TABLE IF NOT EXISTS provenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cve_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  source_value TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (cve_id) REFERENCES cves (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_provenance_cve ON provenance (cve_id);

-- Sync run logs
CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  status TEXT NOT NULL,
  items_synced INTEGER DEFAULT 0,
  error_details TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source ON sync_runs (source_id);

-- Notification rules and logs
CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  webhook_url TEXT,
  min_severity TEXT DEFAULT 'HIGH',
  cisa_kev_only INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cve_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  error_message TEXT
);
`;
