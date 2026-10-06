import { UserRole } from "@prisma/client";
import { ApiError, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";

export async function GET() {
  try {
    const session = await getSession();
    if (session?.role !== UserRole.ADMIN) throw new ApiError(403, "System administrator access required.");
    const [audit, verifications] = await Promise.all([
      withRlsContext(session, (tx) =>
        tx.auditLog.findMany({
          take: 40,
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { email: true } } },
        }),
      ),
      withRlsContext(session, (tx) =>
        tx.qRVerificationLog.findMany({
          take: 40,
          orderBy: { verifiedAt: "desc" },
          select: { id: true, isAuthentic: true, tokenHash: true, verifiedAt: true },
        }),
      ),
    ]);
    return Response.json({ audit, verifications });
  } catch (error) {
    return errorResponse(error);
  }
}
