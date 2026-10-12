import { ApiError, errorResponse } from "@/lib/api";
import { getSession, isStaff } from "@/lib/auth";
import { validateStoredUpload } from "@/lib/file-safety";
import { withRlsContext } from "@/lib/rls";
import { createDownloadUrl, deleteObject } from "@/lib/storage";
import { canAccessSupportingDocument } from "@/lib/upload-access";

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
      if (!found || !["CLEAN", "COMPLETE"].includes(found.status)) {
        throw new ApiError(404, "File not found.");
      }
      if (!isStaff(session)) {
        const parent = await tx.documentRequest.findUnique({
          where: { id: found.requestId },
          select: { residentId: true },
        });
        if (
          !parent ||
          !canAccessSupportingDocument(session.userId, parent.residentId, session.role)
        ) {
          throw new ApiError(404, "File not found.");
        }
      }
      return found;
    });

    try {
      await validateStoredUpload(file.objectKey, file.mimeType, file.sizeBytes);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        await withRlsContext(session, (tx) =>
          tx.supportingDocument.update({ where: { id }, data: { status: "REJECTED" } }),
        );
        try {
          await deleteObject(file.objectKey);
        } catch (cleanupError) {
          console.error("Could not remove an invalid supporting upload", {
            uploadId: id,
            cleanupError,
          });
          throw new ApiError(503, "The invalid file was blocked, but storage cleanup is pending.");
        }
      }
      throw error;
    }

    return Response.redirect(await createDownloadUrl(file.objectKey), 302);
  } catch (error) {
    return errorResponse(error);
  }
}
