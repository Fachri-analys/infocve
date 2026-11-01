import { createHash, timingSafeEqual } from "node:crypto";

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
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

export function getClientIp(request: Request): string {
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
