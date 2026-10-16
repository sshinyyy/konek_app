import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  withRlsContext: vi.fn(),
  findAuditLogs: vi.fn(),
  countAdminActions: vi.fn(),
  findVerifications: vi.fn(),
  findUsers: vi.fn(),
  findRequests: vi.fn(),
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
    mocks.findAuditLogs.mockResolvedValue([{
      id: "recent-action",
      action: "DOCUMENT_ISSUED",
      entity: "DocumentRequest",
      entityId: "request-1",
      actor: { email: "admin@example.test", role: "ADMIN" },
    }]);
    mocks.findVerifications.mockResolvedValue([{ id: "scan-1" }]);
    mocks.countAdminActions.mockResolvedValue(72);
    mocks.findUsers.mockResolvedValue([]);
    mocks.findRequests.mockResolvedValue([{ id: "request-1", referenceNo: "BR-2026-0001" }]);
    mocks.withRlsContext.mockImplementation(async (_session, callback) =>
      callback({
        auditLog: {
          findMany: mocks.findAuditLogs,
          count: mocks.countAdminActions,
        },
        qRVerificationLog: { findMany: mocks.findVerifications },
        user: { findMany: mocks.findUsers },
        documentRequest: { findMany: mocks.findRequests },
      }),
    );
  });

  it("returns the all-time action count and resolves the affected request", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.audit).toHaveLength(1);
    expect(body.adminActionCount).toBe(72);
    expect(body.audit[0].target).toEqual({
      kind: "DOCUMENT_REQUEST",
      label: "BR-2026-0001",
    });
    expect(body.audit[0].actor).toEqual({
      email: "admin@example.test",
      role: "ADMIN",
    });
    expect(mocks.findRequests).toHaveBeenCalledWith({
      where: { id: { in: ["request-1"] } },
      select: { id: true, referenceNo: true },
    });
    expect(mocks.countAdminActions).toHaveBeenCalledWith({
      where: { actor: { is: { role: "ADMIN" } } },
    });
  });
});
