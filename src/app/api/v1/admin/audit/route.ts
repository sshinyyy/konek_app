import { UserRole } from "@prisma/client";
import { ApiError, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";

export async function GET() {
  try {
    const session = await getSession();
    if (session?.role !== UserRole.ADMIN) throw new ApiError(403, "System administrator access required.");
    const { audit, verifications, adminActionCount } = await withRlsContext(session, async (tx) => {
      const [events, verifications, adminActionCount] = await Promise.all([
        tx.auditLog.findMany({
          take: 40,
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { email: true, role: true } } },
        }),
        tx.qRVerificationLog.findMany({
          take: 40,
          orderBy: { verifiedAt: "desc" },
          select: { id: true, isAuthentic: true, tokenHash: true, verifiedAt: true },
        }),
        tx.auditLog.count({
          where: { actor: { is: { role: UserRole.ADMIN } } },
        }),
      ]);
      const userIds = [...new Set(events
        .filter((event) => ["User", "StaffProfile"].includes(event.entity) && event.entityId)
        .map((event) => event.entityId!))];
      const requestIds = [...new Set(events
        .filter((event) => event.entity === "DocumentRequest" && event.entityId)
        .map((event) => event.entityId!))];
      const [users, requests] = await Promise.all([
        userIds.length
          ? tx.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, email: true, role: true },
            })
          : Promise.resolve([]),
        requestIds.length
          ? tx.documentRequest.findMany({
              where: { id: { in: requestIds } },
              select: { id: true, referenceNo: true },
            })
          : Promise.resolve([]),
      ]);
      const usersById = new Map(users.map((user) => [user.id, user]));
      const requestsById = new Map(requests.map((request) => [request.id, request]));
      const audit = events.map((event) => {
        const user = event.entityId && ["User", "StaffProfile"].includes(event.entity)
          ? usersById.get(event.entityId)
          : undefined;
        const request = event.entityId && event.entity === "DocumentRequest"
          ? requestsById.get(event.entityId)
          : undefined;
        return {
          ...event,
          target: user
            ? { kind: user.role, label: user.email }
            : request
              ? { kind: "DOCUMENT_REQUEST", label: request.referenceNo }
              : { kind: event.entity, label: event.entityId ?? "Workspace settings" },
        };
      });
      return { audit, verifications, adminActionCount };
    });
    return Response.json({ audit, verifications, adminActionCount });
  } catch (error) {
    return errorResponse(error);
  }
}
