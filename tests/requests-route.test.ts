import { beforeEach, describe, expect, it, vi } from "vitest";

const { groupBy, findMany } = vi.hoisted(() => ({
  groupBy: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => ({
    userId: "resident-id",
    email: "resident@example.test",
    role: "RESIDENT",
  })),
  isStaff: vi.fn(() => false),
}));

vi.mock("@/lib/rls", () => ({
  withRlsContext: (
    _session: unknown,
    callback: (tx: { documentRequest: { groupBy: typeof groupBy; findMany: typeof findMany } }) => unknown,
  ) => callback({ documentRequest: { groupBy, findMany } }),
}));

import { GET } from "@/app/api/v1/requests/route";

describe("GET /api/v1/requests", () => {
  beforeEach(() => {
    groupBy.mockReset().mockResolvedValue([{ status: "PENDING", _count: { _all: 3 } }]);
    findMany.mockReset().mockResolvedValue([]);
  });

  it("includes aggregate counts by default", async () => {
    const response = await GET(new Request("https://barangay.example.test/api/v1/requests"));

    expect(groupBy).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      counts: { PENDING: 3 },
      totalCount: 3,
      requests: [],
      nextPage: null,
    });
  });

  it("skips aggregate counts when loading a later page without a summary", async () => {
    const response = await GET(new Request(
      "https://barangay.example.test/api/v1/requests?page=1&includeSummary=false",
    ));

    expect(groupBy).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 51 }));
    const body = await response.json();
    expect(body).not.toHaveProperty("counts");
    expect(body).not.toHaveProperty("totalCount");
    expect(body).toMatchObject({ requests: [], nextPage: null });
  });
});
