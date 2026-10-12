import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { verifySessionToken, type Session } from "@/lib/session-token";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/rls", () => ({ withRlsContext: vi.fn() }));
vi.mock("@/lib/session-token", () => ({
  SESSION_COOKIE: "session",
  verifySessionToken: vi.fn(),
}));

const session: Session = {
  userId: "resident-1",
  email: "old@example.test",
  role: "RESIDENT",
};

describe("getSession account revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: "signed-session" }),
    } as never);
    vi.mocked(verifySessionToken).mockResolvedValue(session);
  });

  it("returns the current active account and email", async () => {
    vi.mocked(withRlsContext).mockImplementation(async () => ({
      email: "resident@example.test",
      role: "RESIDENT",
      isActive: true,
    }) as never);

    await expect(getSession()).resolves.toEqual({
      ...session,
      email: "resident@example.test",
    });
  });

  it("rejects disabled accounts and accounts whose role changed", async () => {
    vi.mocked(withRlsContext).mockImplementation(async () => ({
      email: session.email,
      role: "RESIDENT",
      isActive: false,
    }) as never);
    await expect(getSession()).resolves.toBeNull();

    vi.mocked(withRlsContext).mockImplementation(async () => ({
      email: session.email,
      role: "STAFF",
      isActive: true,
    }) as never);
    await expect(getSession()).resolves.toBeNull();
  });

  it("does not query the account when the token is invalid", async () => {
    vi.mocked(verifySessionToken).mockResolvedValue(null);
    await expect(getSession()).resolves.toBeNull();
    expect(withRlsContext).not.toHaveBeenCalled();
  });
});
