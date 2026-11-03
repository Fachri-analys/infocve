import { createHash, timingSafeEqual } from "node:crypto";
import { ensureNeonCveSchema, getNeonCveClient } from "@/lib/db/neon-cve-repository";

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  unavailable?: boolean;
}

export function evaluateRateLimitCount(count: number, windowStart: number, now: number, config: RateLimitConfig): RateLimitResult {
  const windowMs = config.windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
  return {
    success: count <= config.maxRequests,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    retryAfterSeconds: count > config.maxRequests ? retryAfterSeconds : 0,
  };
}

class IpRateLimiter {
  private requests = new Map<string, number[]>();

  check(ip: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const windowStart = now - windowMs;

    const timestamps = (this.requests.get(ip) || []).filter((t) => t > windowStart);

    if (timestamps.length >= config.maxRequests) {
      const oldest = timestamps[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      this.requests.set(ip, timestamps);
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    timestamps.push(now);
    this.requests.set(ip, timestamps);
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  reset(): void {
    this.requests.clear();
  }
}

export const syncRateLimiter = new IpRateLimiter();
export const scanRateLimiter = new IpRateLimiter();

export async function checkSharedRateLimit(key: string, config: RateLimitConfig, fallback: IpRateLimiter): Promise<RateLimitResult> {
  if (!process.env.DATABASE_URL?.trim() && !process.env.POSTGRES_URL?.trim()) {
    if (process.env.VERCEL) return { success: false, limit: config.maxRequests, remaining: 0, retryAfterSeconds: config.windowSeconds, unavailable: true };
    return fallback.check(key, config);
  }

  try {
    const sql = getNeonCveClient();
    if (!sql) throw new Error("Neon connection is not configured.");
    await ensureNeonCveSchema(sql);
    const now = Date.now();
    const windowMs = Math.max(1, config.windowSeconds) * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const rows = await sql.query(`INSERT INTO infocve_rate_limits (rate_key, window_start, request_count)
      VALUES ($1, $2::timestamptz, 1)
      ON CONFLICT (rate_key, window_start) DO UPDATE SET request_count = infocve_rate_limits.request_count + 1
      RETURNING request_count`, [key, new Date(windowStart).toISOString()]) as Array<{ request_count: number | string }>;
    const count = Number(rows[0]?.request_count ?? config.maxRequests + 1);
    return evaluateRateLimitCount(count, windowStart, now, config);
  } catch {
    return { success: false, limit: config.maxRequests, remaining: 0, retryAfterSeconds: config.windowSeconds, unavailable: true };
  }
}

export function getClientIp(request: Request): string {
  const trustedProxy = process.env.VERCEL === "1" || process.env.TRUST_PROXY_HEADERS === "1";
  if (!trustedProxy) return "local-client";
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

/**
 * Constant-time string comparison by pre-hashing both inputs with SHA-256.
 * This guarantees equal buffer lengths and protects against timing side-channels.
 */
export function timingSafeStringCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
