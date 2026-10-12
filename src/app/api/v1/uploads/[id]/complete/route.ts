import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { fileExtensionForMime, validateStoredUpload } from "@/lib/file-safety";
import { withRlsContext } from "@/lib/rls";
import { deleteObject, uploadObject } from "@/lib/storage";

async function rejectUpload(
  id: string,
  objectKey: string,
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
) {
  await withRlsContext(session, (tx) =>
    tx.supportingDocument.update({ where: { id }, data: { status: "REJECTED" } }),
  );
  try {
    await deleteObject(objectKey);
  } catch (error) {
    console.error("Could not remove a rejected supporting upload", { uploadId: id, error });
    throw new ApiError(503, "The invalid file was rejected, but storage cleanup is pending.");
  }
}

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
    if (file.status === "CLEAN" || file.status === "COMPLETE") return Response.json({ ok: true });
    if (file.status === "REJECTED") throw new ApiError(409, "This uploaded file was rejected.");

    let bytes: Uint8Array;
    try {
      bytes = await validateStoredUpload(file.objectKey, file.mimeType, file.sizeBytes);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        await rejectUpload(file.id, file.objectKey, session);
      }
      throw error;
    }

    const extension = fileExtensionForMime(file.mimeType);
    const storedObjectKey = `requirements/${session.userId}/${file.id}.${extension}`;
    await uploadObject(storedObjectKey, bytes, file.mimeType);
    await withRlsContext(session, (tx) =>
      tx.supportingDocument.update({
        where: { id: file.id },
        data: { objectKey: storedObjectKey, status: "COMPLETE" },
      }),
    );

    let cleanupPending = false;
    try {
      await deleteObject(file.objectKey);
    } catch (error) {
      cleanupPending = true;
      console.error("Could not remove a completed quarantine upload", { uploadId: file.id, error });
    }
    return Response.json({ ok: true, cleanupPending });
  } catch (error) {
    return errorResponse(error);
  }
}
