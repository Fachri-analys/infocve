import type { CVE } from "@/types/cve";

/**
 * Metadata describing a vulnerability data source
 */
export interface SourceMetadata {
  id: string;
  name: string;
  description: string;
  homepage: string;
  license: string;
  updateFrequency: string;
}

/**
 * Standard configuration for a vulnerability source
 */
export interface SourceConfig {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  authHeaderName?: string;
  authHeaderPrefix?: string;
  timeoutMs?: number;
  cacheTtlSeconds?: number;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

/**
 * Custom error class for source-specific API errors
 */
export class SourceApiError extends Error {
  readonly sourceId: string;
  readonly statusCode?: number;
  readonly isRetryable: boolean;

  constructor(sourceId: string, message: string, options?: { statusCode?: number; isRetryable?: boolean; cause?: unknown }) {
    super(`[${sourceId}] ${message}`);
    this.name = "SourceApiError";
    this.sourceId = sourceId;
    this.statusCode = options?.statusCode;
    this.isRetryable = options?.isRetryable ?? (options?.statusCode ? options.statusCode >= 500 || options.statusCode === 429 : false);
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * In-memory sliding window rate limiter per source
 */
export class SourceRateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 50, windowMs = 30000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0] ?? now;
      const waitTime = this.windowMs - (now - oldest) + 50;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
      return this.acquire();
    }

    this.timestamps.push(Date.now());
  }
}

/**
 * Public adapter interface for vulnerability sources
 */
export interface VulnerabilitySourceAdapter {
  metadata: SourceMetadata;
  config: SourceConfig;
  fetchLatest(limit?: number): Promise<unknown>;
  fetchById(id: string): Promise<unknown>;
  testConnection(): Promise<boolean>;
  enrichCve?(cve: CVE): Promise<CVE>;
}

/**
 * Abstract base class providing common transport, rate limiting, authentication,
 * caching, and error handling for vulnerability intelligence sources.
 */
export abstract class BaseVulnerabilitySource<TRaw = unknown, TNormalized = unknown> implements VulnerabilitySourceAdapter {
  readonly metadata: SourceMetadata;
  readonly config: SourceConfig;
  protected rateLimiter: SourceRateLimiter;

  constructor(metadata: SourceMetadata, config: SourceConfig = {}) {
    this.metadata = metadata;
    this.config = {
      enabled: true,
      timeoutMs: 10000,
      cacheTtlSeconds: 86400,
      ...config,
    };

    const limit = this.config.rateLimit || { maxRequests: 60, windowMs: 60000 };
    this.rateLimiter = new SourceRateLimiter(limit.maxRequests, limit.windowMs);
  }

  get isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Safe authenticated and rate-limited HTTP fetch wrapper
   */
  protected async fetchHttp<T = TRaw>(url: string, init?: RequestInit): Promise<T> {
    if (!this.isEnabled) {
      throw new SourceApiError(this.metadata.id, "Source is disabled via configuration.");
    }

    await this.rateLimiter.acquire();

    const headers = new Headers(init?.headers || {});
    headers.set("User-Agent", "InfoCVE/0.1.0 (Security Intelligence Platform)");

    if (this.config.apiKey) {
      const headerName = this.config.authHeaderName || "Authorization";
      const prefix = this.config.authHeaderPrefix ? `${this.config.authHeaderPrefix} ` : "";
      headers.set(headerName, `${prefix}${this.config.apiKey}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 10000);

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
        next: {
          revalidate: this.config.cacheTtlSeconds,
          ...init?.next,
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new SourceApiError(this.metadata.id, `HTTP ${response.status}: ${response.statusText}`, {
          statusCode: response.status,
        });
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof SourceApiError) {
        throw err;
      }
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new SourceApiError(
        this.metadata.id,
        isAbort ? "Request timed out" : (err instanceof Error ? err.message : String(err)),
        { isRetryable: true, cause: err }
      );
    }
  }

  abstract fetchById(id: string): Promise<TNormalized | null>;
  abstract fetchLatest(limit?: number): Promise<unknown>;
  abstract testConnection(): Promise<boolean>;

  async enrichCve(cve: CVE): Promise<CVE> {
    return cve;
  }
}
