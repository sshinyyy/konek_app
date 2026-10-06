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
    const document = await withRlsContext(session, async (tx) => {
      const row = await tx.issuedDocument.findFirst({
        where: { requestId: id },
        select: { pdfObjectKey: true, request: { select: { residentId: true } } },
      });
      if (!row || (!isStaff(session) && row.request.residentId !== session.userId)) {
        throw new ApiError(404, "Issued document not found.");
      }
      return row;
    });
    return Response.redirect(await createDownloadUrl(document.pdfObjectKey), 302);
  } catch (error) {
    return errorResponse(error);
  }
}
