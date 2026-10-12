import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";

type RateLimitName = "login" | "register" | "verify" | "upload";

const policies: Record<RateLimitName, { max: number; windowSeconds: number }> = {
  login: { max: 10, windowSeconds: 60 },
  register: { max: 5, windowSeconds: 3600 },
  verify: { max: 30, windowSeconds: 60 },
  upload: { max: 10, windowSeconds: 3600 },
};

const incrementScript = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "return {count, redis.call('PTTL', KEYS[1])}",
].join("\n");

function getPolicy(name: RateLimitName) {
  const defaults = policies[name];
  const prefix = `RATE_LIMIT_${name.toUpperCase()}`;
  const max = positiveInteger(process.env[`${prefix}_MAX`], defaults.max);
  const windowSeconds = positiveInteger(
    process.env[`${prefix}_WINDOW_SECONDS`],
    defaults.windowSeconds,
  );
  if (!max || !windowSeconds || max > 100_000 || windowSeconds > 86_400) {
    throw new ApiError(503, "Request protection is temporarily unavailable.");
  }
  return { max, windowSeconds };
}

function positiveInteger(value: string | undefined, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
  return address || request.headers.get("x-real-ip") || "unknown";
}

export async function rateLimitResponse(
  request: Request,
  name: RateLimitName,
  subject?: string,
): Promise<NextResponse | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const salt = process.env.IP_HASH_SALT;

  if (!url || !token || !salt || salt.length < 32) {
    if (process.env.NODE_ENV !== "production") return null;
    throw new ApiError(503, "Request protection is temporarily unavailable.");
  }

  let redisUrl: URL;
  try {
    redisUrl = new URL(url);
  } catch {
    throw new ApiError(503, "Request protection is temporarily unavailable.");
  }
  if (redisUrl.protocol !== "https:") {
    throw new ApiError(503, "Request protection is temporarily unavailable.");
  }

  const { max, windowSeconds } = getPolicy(name);
  const identity = subject ? `${name}:user:${subject}` : `${name}:ip:${clientAddress(request)}`;
  const identityHash = createHash("sha256").update(`${salt}:${identity}`).digest("hex");

  let response: Response;
  try {
    response = await fetch(redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        incrementScript,
        "1",
        `konek:rate:${identityHash}`,
        String(windowSeconds * 1000),
      ]),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    throw new ApiError(503, "Request protection is temporarily unavailable.");
  }

  if (!response.ok) {
    throw new ApiError(503, "Request protection is temporarily unavailable.");
  }

  const result = (await response.json().catch(() => null)) as
    | { result?: unknown; error?: string }
    | null;
  if (
    !result ||
    result.error ||
    !Array.isArray(result.result) ||
    result.result.length !== 2
  ) {
    throw new ApiError(503, "Request protection is temporarily unavailable.");
  }

  const [count, ttl] = result.result.map(Number);
  if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
    throw new ApiError(503, "Request protection is temporarily unavailable.");
  }
  if (count <= max) return null;

  const retryAfter = Math.max(1, Math.ceil(ttl / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please wait before trying again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
