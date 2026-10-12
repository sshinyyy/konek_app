import { describe, expect, it } from "vitest";
import { roleCanAccessPath, sessionMatchesActiveAccount } from "@/lib/session-access";

const resident = { userId: "resident-1", email: "resident@example.test", role: "RESIDENT" as const };

describe("session account checks", () => {
  it("accepts an active account with the same role", () => {
    expect(
      sessionMatchesActiveAccount(resident, {
        email: resident.email,
        role: "RESIDENT",
        isActive: true,
      }),
    ).toBe(true);
  });

  it("rejects disabled, missing, or role-changed accounts", () => {
    expect(
      sessionMatchesActiveAccount(resident, {
        email: resident.email,
        role: "RESIDENT",
        isActive: false,
      }),
    ).toBe(false);
    expect(
      sessionMatchesActiveAccount(resident, {
        email: resident.email,
        role: "STAFF",
        isActive: true,
      }),
    ).toBe(false);
    expect(sessionMatchesActiveAccount(resident, null)).toBe(false);
  });
});

describe("role-based path checks", () => {
  it("allows staff and admins to process requests, but not residents", () => {
    expect(roleCanAccessPath("RESIDENT", "/api/v1/requests/123/decision")).toBe(false);
    expect(roleCanAccessPath("STAFF", "/api/v1/requests/123/decision")).toBe(true);
    expect(roleCanAccessPath("ADMIN", "/staff")).toBe(true);
  });

  it("restricts the admin console to administrators", () => {
    expect(roleCanAccessPath("RESIDENT", "/admin")).toBe(false);
    expect(roleCanAccessPath("STAFF", "/admin")).toBe(false);
    expect(roleCanAccessPath("ADMIN", "/admin")).toBe(true);
  });
});
