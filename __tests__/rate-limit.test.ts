import { describe, expect, it } from "vitest";
import { evaluateRateLimitCount } from "@/lib/security/rate-limit";

describe("shared rate limit decisions", () => {
  it("allows requests up to the configured count", () => {
    expect(evaluateRateLimitCount(4, 100_000, 101_000, { maxRequests: 5, windowSeconds: 60 })).toMatchObject({
      success: true, remaining: 1, retryAfterSeconds: 0,
    });
  });

  it("blocks the next request until the shared fixed window expires", () => {
    expect(evaluateRateLimitCount(6, 100_000, 101_000, { maxRequests: 5, windowSeconds: 60 })).toMatchObject({
      success: false, remaining: 0, retryAfterSeconds: 59,
    });
  });
});
