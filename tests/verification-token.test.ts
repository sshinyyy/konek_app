import { describe, expect, it } from "vitest";
import { isVerificationToken } from "@/lib/verification-token";

describe("QR verification tokens", () => {
  it("accepts URL-safe tokens within the supported length", () => {
    expect(isVerificationToken("a".repeat(32))).toBe(true);
    expect(isVerificationToken(`${"a".repeat(63)}_-`)).toBe(true);
    expect(isVerificationToken("a".repeat(128))).toBe(true);
  });

  it("rejects short, long, or non-URL-safe token values", () => {
    expect(isVerificationToken("a".repeat(31))).toBe(false);
    expect(isVerificationToken("a".repeat(129))).toBe(false);
    expect(isVerificationToken(`${"a".repeat(31)}!`)).toBe(false);
  });
});
