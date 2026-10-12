import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { claimRequestTransition } from "@/lib/request-state";
import type { Prisma } from "@prisma/client";

function transaction(updateCount: number, exists = true) {
  return {
    documentRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
      findUnique: vi.fn().mockResolvedValue(exists ? { id: "request-1" } : null),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("concurrent document request decisions", () => {
  it("atomically claims only the allowed source states", async () => {
    const tx = transaction(1);
    await claimRequestTransition(tx, "request-1", "issue", {
      decidedById: "staff-1",
      remarks: null,
    });

    expect(tx.documentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-1", status: { in: ["PENDING", "IN_REVIEW"] } },
      data: { decidedById: "staff-1", remarks: null, status: "APPROVED" },
    });
  });

  it("allows review to claim only pending requests", async () => {
    const tx = transaction(1);
    await claimRequestTransition(tx, "request-1", "review");
    expect(tx.documentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-1", status: { in: ["PENDING"] } },
      data: { status: "IN_REVIEW" },
    });
  });

  it("returns conflict if another decision has already claimed the request", async () => {
    const tx = transaction(0);
    await expect(claimRequestTransition(tx, "request-1", "reject")).rejects.toMatchObject({
      status: 409,
    } satisfies Partial<ApiError>);
    expect(tx.documentRequest.findUnique).toHaveBeenCalledWith({
      where: { id: "request-1" },
      select: { id: true },
    });
  });

  it("returns not found when the request does not exist", async () => {
    await expect(
      claimRequestTransition(transaction(0, false), "missing", "reject"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("allows only one competing terminal decision to claim an open request", async () => {
    let status = "PENDING";
    const tx = {
      documentRequest: {
        updateMany: vi.fn(async ({ where, data }) => {
          if (!(where.status.in as string[]).includes(status)) return { count: 0 };
          status = data.status as string;
          return { count: 1 };
        }),
        findUnique: vi.fn(async () => ({ id: "request-1" })),
      },
    } as unknown as Prisma.TransactionClient;

    const outcomes = await Promise.allSettled([
      claimRequestTransition(tx, "request-1", "issue"),
      claimRequestTransition(tx, "request-1", "reject"),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(["APPROVED", "REJECTED"]).toContain(status);
  });
});
