import { UserRole } from "@prisma/client";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";

const schema = z.object({ isActive: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (session?.role !== UserRole.ADMIN) throw new ApiError(403, "System administrator access required.");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Provide an active status.");
    const { id } = await context.params;
    await withRlsContext(session, async (tx) => {
      const result = await tx.user.updateMany({
        where: { id, role: UserRole.STAFF },
        data: { isActive: parsed.data.isActive },
      });
      if (result.count !== 1) throw new ApiError(404, "Staff account not found.");
      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: parsed.data.isActive ? "STAFF_ACCOUNT_ENABLED" : "STAFF_ACCOUNT_DISABLED",
          entity: "User",
          entityId: id,
        },
      });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
