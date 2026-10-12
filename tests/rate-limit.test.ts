import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimitResponse } from "@/lib/rate-limit";

const request = new Request("https://barangay.example.test/api/v1/auth/login", {
  method: "POST",
  headers: { "x-forwarded-for": "198.51.100.20" },
});

describe("distributed rate limiting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function configureRedis() {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("IP_HASH_SALT", "s".repeat(32));
  }

  it("allows requests under the configured limit and hashes client identifiers", async () => {
    configureRedis();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: [1, 60_000] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await rateLimitResponse(request, "login")).toBeNull();
    const command = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as string[];
    expect(command[3]).not.toContain("198.51.100.20");
    expect(command[3]).toMatch(/^konek:rate:[a-f0-9]{64}$/);
  });

  it("returns 429 with Retry-After after the limit is exceeded", async () => {
    configureRedis();
    vi.stubEnv("RATE_LIMIT_LOGIN_MAX", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ result: [1, 60_000] }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ result: [2, 24_500] }), { status: 200 })),
    );

    expect(await rateLimitResponse(request, "login")).toBeNull();
    const limited = await rateLimitResponse(request, "login");
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("Retry-After")).toBe("25");
  });

  it("fails closed in production when the distributed limiter is unavailable", async () => {
    configureRedis();
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await expect(rateLimitResponse(request, "register")).rejects.toMatchObject({
      status: 503,
    });
  });

  it("fails closed if the Redis service fails", async () => {
    configureRedis();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(rateLimitResponse(request, "verify")).rejects.toMatchObject({
      status: 503,
    });
  });
});
