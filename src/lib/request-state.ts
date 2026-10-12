import { RequestStatus, type Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";

export type RequestAction = "review" | "reject" | "issue";

const transitionRules: Record<
  RequestAction,
  { from: RequestStatus[]; to: RequestStatus; conflict: string }
> = {
  review: {
    from: [RequestStatus.PENDING],
    to: RequestStatus.IN_REVIEW,
    conflict: "This request is no longer pending.",
  },
  reject: {
    from: [RequestStatus.PENDING, RequestStatus.IN_REVIEW],
    to: RequestStatus.REJECTED,
    conflict: "This request has already been processed.",
  },
  issue: {
    from: [RequestStatus.PENDING, RequestStatus.IN_REVIEW],
    to: RequestStatus.APPROVED,
    conflict: "This request has already been processed.",
  },
};

export async function claimRequestTransition(
  transaction: Prisma.TransactionClient,
  id: string,
  action: RequestAction,
  data: Prisma.DocumentRequestUpdateManyMutationInput = {},
): Promise<void> {
  const rule = transitionRules[action];
  const result = await transaction.documentRequest.updateMany({
    where: { id, status: { in: rule.from } },
    data: { ...data, status: rule.to },
  });
  if (result.count === 1) return;

  const existing = await transaction.documentRequest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Request not found.");
  throw new ApiError(409, rule.conflict);
}
