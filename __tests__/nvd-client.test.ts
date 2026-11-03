import { describe, expect, it } from "vitest";
import { getNvdErrorDetail } from "@/lib/nvd-client";

describe("NVD error details", () => {
  it("reads the reason from NVD's message response header", () => {
    expect(getNvdErrorDetail(new Headers({ message: "resultsPerPage parameter cannot exceed 2000." }), null))
      .toBe("resultsPerPage parameter cannot exceed 2000.");
  });

  it("falls back to a JSON error message and bounds the detail length", () => {
    expect(getNvdErrorDetail(new Headers(), { message: "Invalid date range" })).toBe("Invalid date range");
    expect(getNvdErrorDetail(new Headers(), { message: "x".repeat(600) })).toHaveLength(500);
  });
});
