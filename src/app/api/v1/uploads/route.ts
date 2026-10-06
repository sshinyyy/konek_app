import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { createUploadUrl } from "@/lib/storage";

const schema = z.object({
  requestId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    if (session.role !== "RESIDENT") throw new ApiError(403, "Only residents can upload requirements.");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "The file type or size is not allowed.");
    const input = parsed.data;
    const result = await withRlsContext(session, async (tx) => {
      const target = await tx.documentRequest.findFirst({
        where: { id: input.requestId, residentId: session.userId, status: "PENDING" },
        select: { id: true },
      });
      if (!target) throw new ApiError(404, "Open request not found.");
      const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "file";
      const objectKey = `requirements/${session.userId}/${randomUUID()}.${extension}`;
      const uploadUrl = await createUploadUrl(objectKey, input.mimeType, input.sizeBytes);
      const upload = await tx.supportingDocument.create({
        data: {
          requestId: input.requestId,
          objectKey,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        },
        select: { id: true, fileName: true },
      });
      return { ...upload, uploadUrl };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
