import { ApiError, errorResponse } from "@/lib/api";
import { getSession, isStaff } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { createDownloadUrl } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    const { id } = await context.params;
    const file = await withRlsContext(session, async (tx) => {
      const found = await tx.supportingDocument.findUnique({ where: { id } });
      if (!found || found.status !== "COMPLETE") throw new ApiError(404, "File not found.");
      if (!isStaff(session)) {
        const parent = await tx.documentRequest.findUnique({
          where: { id: found.requestId },
          select: { residentId: true },
        });
        if (parent?.residentId !== session.userId) throw new ApiError(404, "File not found.");
      }
      return found;
    });
    return Response.redirect(await createDownloadUrl(file.objectKey), 302);
  } catch (error) {
    return errorResponse(error);
  }
}
