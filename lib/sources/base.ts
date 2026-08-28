/**
 * Base interfaces for vulnerability intelligence sources
 */

export interface SourceMetadata {
  id: string;
  name: string;
  description: string;
  homepage: string;
  license: string;
  updateFrequency: string;
}

export interface VulnerabilitySourceAdapter {
  metadata: SourceMetadata;
  fetchLatest(limit?: number): Promise<unknown>;
  fetchById(id: string): Promise<unknown>;
  testConnection(): Promise<boolean>;
}
