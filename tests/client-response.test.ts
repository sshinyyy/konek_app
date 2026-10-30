import { describe, expect, it } from "vitest";
import { readJsonResponse } from "@/lib/client-response";

describe("client API response parsing", () => {
  it("parses a JSON response body", async () => {
    const response = Response.json({ message: "done" });
    await expect(readJsonResponse<{ message: string }>(response, "Request failed.")).resolves.toEqual({
      message: "done",
    });
  });

  it("returns a user-friendly fallback for a non-JSON response", async () => {
    const response = new Response("<html>Server error</html>", {
      headers: { "Content-Type": "text/html" },
      status: 500,
    });
    await expect(readJsonResponse(response, "Request failed.")).rejects.toThrow("Request failed.");
  });
});
