import { describe, expect, it } from "vitest";
import { parseRequestPage, REQUEST_PAGE_SIZE } from "@/lib/request-pagination";

describe("request pagination", () => {
  it("uses page zero by default and fixes a bounded page size", () => {
    expect(parseRequestPage(null)).toBe(0);
    expect(parseRequestPage("2")).toBe(2);
    expect(REQUEST_PAGE_SIZE).toBe(50);
  });

  it("rejects invalid and out-of-range page values", () => {
    for (const page of ["-1", "1.5", "NaN", "100001"]) {
      expect(() => parseRequestPage(page)).toThrow("Invalid request page.");
    }
  });
});
