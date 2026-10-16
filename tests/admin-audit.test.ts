import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  withRlsContext: vi.fn(),
  findAuditLogs: vi.fn(),
  countAdminActions: vi.fn(),
  findVerifications: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/rls", () => ({ withRlsContext: mocks.withRlsContext }));

import { GET } from "@/app/api/v1/admin/audit/route";

describe("admin audit endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      userId: "admin-1",
      email: "admin@example.test",
      role: "ADMIN",
    });
    mocks.findAuditLogs.mockResolvedValue([{ id: "recent-action" }]);
    mocks.findVerifications.mockResolvedValue([{ id: "scan-1" }]);
    mocks.countAdminActions.mockResolvedValue(72);
    mocks.withRlsContext.mockImplementation(async (_session, callback) =>
      callback({
        auditLog: {
          findMany: mocks.findAuditLogs,
          count: mocks.countAdminActions,
        },
        qRVerificationLog: { findMany: mocks.findVerifications },
      }),
    );
  });

  it("returns the full admin-action count separately from the recent activity list", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.audit).toHaveLength(1);
    expect(body.adminActionCount).toBe(72);
    expect(mocks.countAdminActions).toHaveBeenCalledWith({
      where: { actor: { is: { role: "ADMIN" } } },
    });
  });
});
