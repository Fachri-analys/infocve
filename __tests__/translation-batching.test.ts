import { describe, expect, it } from "vitest";
import { getSafeTranslationGroupLimit, groupTranslationJobs } from "@/lib/translation/batching";

function job(index: number, source_text = `description-${index}`) {
  return { source_hash: `hash-${index}`, source_text, attempts: 0 };
}

describe("translation request grouping", () => {
  it("caps each LibreTranslate request at 32 texts", () => {
    const groups = groupTranslationJobs(Array.from({ length: 40 }, (_, index) => job(index)));
    expect(groups.map(({ jobs: items }) => items.length)).toEqual([32, 8]);
  });

  it("caps request bodies by total characters and isolates provider-oversized descriptions", () => {
    const groups = groupTranslationJobs([job(1, "a".repeat(40_000)), job(2, "b".repeat(30_000)), job(3, "c".repeat(21_000)), job(4, "d".repeat(20_001))]);
    expect(groups.map(({ jobs: items, charCount }) => [items.length, charCount])).toEqual([[1, 40_000], [1, 30_000], [1, 21_000], [1, 20_001]]);
  });

  it("budgets provider request waves before reserving time for Neon writes", () => {
    expect(getSafeTranslationGroupLimit({
      workBudgetMs: 42_000,
      databaseReserveMs: 8_000,
      concurrency: 8,
      timeoutMs: 4_000,
      attempts: 2,
      retryDelayMs: 400,
    })).toBe(32);
  });
});
