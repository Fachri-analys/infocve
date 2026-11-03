import type { PaginatedResult } from "@/types/cve";

export function unavailableSearchResult<T>(pageSize: number, page = 1): PaginatedResult<T> {
  return {
    results: [],
    total: 0,
    page: Math.max(1, Math.floor(page)),
    pageSize: Math.max(1, Math.floor(pageSize)),
    totalPages: 1,
    available: false,
  };
}
