import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { objectExists } from "@/lib/storage";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    const { id } = await context.params;
    const file = await withRlsContext(session, async (tx) => {
      const found = await tx.supportingDocument.findUnique({ where: { id } });
      if (!found) throw new ApiError(404, "Uploaded requirement not found.");
      const parent = await tx.documentRequest.findUnique({
        where: { id: found.requestId },
        select: { residentId: true, status: true },
      });
      if (!parent || parent.residentId !== session.userId || parent.status !== "PENDING") {
        throw new ApiError(404, "Uploaded requirement not found.");
      }
      return found;
    });
    if (!(await objectExists(file.objectKey))) throw new ApiError(400, "The file has not reached secure storage.");
    await withRlsContext(session, (tx) =>
      tx.supportingDocument.update({ where: { id }, data: { status: "COMPLETE" } }),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
