import { afterEach, describe, expect, it, vi } from "vitest";
import { logPerformance } from "@/lib/performance";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("privacy-safe performance logging", () => {
  it("does not emit timings unless explicitly enabled", () => {
    vi.stubEnv("PERFORMANCE_LOGS", "false");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logPerformance("auth.login", performance.now());

    expect(info).not.toHaveBeenCalled();
  });

  it("logs only the fixed operation name and duration", () => {
    vi.stubEnv("PERFORMANCE_LOGS", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logPerformance("auth.login", performance.now() - 12);

    expect(info).toHaveBeenCalledOnce();
    const event = JSON.parse(String(info.mock.calls[0][0]));
    expect(event).toMatchObject({ event: "app.performance", operation: "auth.login" });
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
    expect(event).not.toHaveProperty("email");
    expect(event).not.toHaveProperty("userId");
  });
});
