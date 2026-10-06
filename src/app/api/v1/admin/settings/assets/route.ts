import { randomUUID } from "node:crypto";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { createUploadUrl } from "@/lib/storage";

const schema = z.object({
  type: z.enum(["seal", "signature"]),
  mimeType: z.enum(["image/png"]),
  sizeBytes: z.number().int().min(1).max(2 * 1024 * 1024),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (session?.role !== UserRole.ADMIN) throw new ApiError(403, "System administrator access required.");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Choose a PNG certificate image up to 2 MB.");
    const objectKey = `settings/${parsed.data.type}/${randomUUID()}.png`;
    const uploadUrl = await createUploadUrl(objectKey, parsed.data.mimeType, parsed.data.sizeBytes);
    return Response.json({ objectKey, uploadUrl }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
