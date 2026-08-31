import type { VulnerabilitySourceAdapter } from "./base";

export interface SourceHealthStatus {
  sourceId: string;
  name: string;
  enabled: boolean;
  healthy: boolean;
  timestamp: string;
  error?: string;
}

export class VulnerabilitySourceRegistry {
  private sources: Map<string, VulnerabilitySourceAdapter> = new Map();

  /**
   * Register a new vulnerability source adapter
   */
  register(adapter: VulnerabilitySourceAdapter): this {
    this.sources.set(adapter.metadata.id.toUpperCase(), adapter);
    return this;
  }

  /**
   * Get an adapter by source ID
   */
  get<T extends VulnerabilitySourceAdapter = VulnerabilitySourceAdapter>(id: string): T | undefined {
    return this.sources.get(id.toUpperCase()) as T | undefined;
  }

  /**
   * Get all registered adapters
   */
  getAll(): VulnerabilitySourceAdapter[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get all enabled adapters
   */
  getEnabled(): VulnerabilitySourceAdapter[] {
    return this.getAll().filter((s) => s.config.enabled !== false);
  }

  /**
   * Test connection and health of all registered sources
   */
  async checkHealth(): Promise<SourceHealthStatus[]> {
    const results: SourceHealthStatus[] = [];
    for (const source of this.getAll()) {
      const now = new Date().toISOString();
      if (source.config.enabled === false) {
        results.push({
          sourceId: source.metadata.id,
          name: source.metadata.name,
          enabled: false,
          healthy: false,
          timestamp: now,
          error: "Disabled by configuration",
        });
        continue;
      }

      try {
        const healthy = await source.testConnection();
        results.push({
          sourceId: source.metadata.id,
          name: source.metadata.name,
          enabled: true,
          healthy,
          timestamp: now,
        });
      } catch (err: unknown) {
        results.push({
          sourceId: source.metadata.id,
          name: source.metadata.name,
          enabled: true,
          healthy: false,
          timestamp: now,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }
}

// Global shared registry instance
export const sourceRegistry = new VulnerabilitySourceRegistry();
