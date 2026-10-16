import { describe, expect, it } from "vitest";
import { assertSameOrigin, readJson } from "@/lib/api";

describe("API request helpers", () => {
  it("parses valid JSON bodies", async () => {
    const request = new Request("https://barangay.example.test/api/v1/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Resident" }),
    });

    await expect(readJson(request)).resolves.toEqual({ fullName: "Resident" });
  });

  it("reports malformed JSON as a client error", async () => {
    const request = new Request("https://barangay.example.test/api/v1/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    await expect(readJson(request)).rejects.toMatchObject({ status: 400 });
  });

  it("accepts same-origin requests and rejects mismatched or malformed origins", () => {
    const sameOrigin = new Request("https://barangay.example.test/api/v1/profile", {
      method: "PATCH",
      headers: { Origin: "https://barangay.example.test" },
    });
    expect(() => assertSameOrigin(sameOrigin)).not.toThrow();

    for (const origin of ["https://attacker.example", "not a valid origin"]) {
      const request = new Request("https://barangay.example.test/api/v1/profile", {
        method: "PATCH",
        headers: { Origin: origin },
      });
      expect(() => assertSameOrigin(request)).toThrow("Cross-origin requests are not permitted.");
    }
  });
});
