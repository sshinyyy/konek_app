import { ApiError, errorResponse } from "@/lib/api";
import { getSession, isStaff } from "@/lib/auth";
import { scanStoredUpload } from "@/lib/file-safety";
import { withRlsContext } from "@/lib/rls";
import { createDownloadUrl, deleteObject, uploadObject } from "@/lib/storage";
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

    if (file.status === "COMPLETE") {
      let scanned;
      try {
        scanned = await scanStoredUpload(file.objectKey, file.mimeType, file.sizeBytes);
      } catch (error) {
        if (error instanceof ApiError && error.status === 422) {
          await withRlsContext(session, (tx) =>
            tx.supportingDocument.update({ where: { id }, data: { status: "REJECTED" } }),
          );
          try {
            await deleteObject(file.objectKey);
          } catch (cleanupError) {
            console.error("Could not remove an unsafe legacy supporting upload", {
              uploadId: id,
              cleanupError,
            });
          }
        }
        throw error;
      }
      if (!scanned.clean) {
        await withRlsContext(session, (tx) =>
          tx.supportingDocument.update({ where: { id }, data: { status: "REJECTED" } }),
        );
        try {
          await deleteObject(file.objectKey);
        } catch (cleanupError) {
          console.error("Could not remove a malware-positive legacy supporting upload", {
            uploadId: id,
            cleanupError,
          });
          throw new ApiError(503, "The unsafe file was blocked, but storage cleanup is pending.");
        }
        throw new ApiError(422, "The uploaded file did not pass the malware scan.");
      }
      await uploadObject(file.objectKey, scanned.bytes, file.mimeType);
      await withRlsContext(session, (tx) =>
        tx.supportingDocument.update({ where: { id }, data: { status: "CLEAN" } }),
      );
    }

    return Response.redirect(await createDownloadUrl(file.objectKey), 302);
  } catch (error) {
    return errorResponse(error);
  }
}
