import { randomBytes } from "node:crypto";
import { DocumentType } from "@prisma/client";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse, readJson } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logPerformance } from "@/lib/performance";
import { withRlsContext } from "@/lib/rls";
import { getRequestPage } from "@/lib/request-query";
import { parseIncludeRequestSummary, parseRequestPage } from "@/lib/request-pagination";

const schema = z.object({
  type: z.enum(["BARANGAY_CLEARANCE", "CERTIFICATE_OF_RESIDENCY", "BARANGAY_ID"]),
  purpose: z.string().trim().min(3).max(500),
});
export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    const searchParams = new URL(request.url).searchParams;
    const page = parseRequestPage(searchParams.get("page"));
    const includeSummary = parseIncludeRequestSummary(searchParams.get("includeSummary"));
    return Response.json(await getRequestPage(session, page, includeSummary));
  } catch (error) {
    return errorResponse(error);
  } finally {
    logPerformance("requests.list", startedAt);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    if (session.role !== "RESIDENT") throw new ApiError(403, "Only residents can submit requests.");
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Please provide a document type and purpose.");
    const created = await withRlsContext(session, async (tx) => {
      const result = await tx.documentRequest.create({
        data: {
          residentId: session.userId,
          referenceNo: `BR-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`,
          type: parsed.data.type as DocumentType,
          purpose: parsed.data.purpose,
        },
        select: { id: true, referenceNo: true, type: true, status: true, submittedAt: true },
      });
      await tx.auditLog.create({
        data: { actorId: session.userId, action: "DOCUMENT_REQUEST_SUBMITTED", entity: "DocumentRequest", entityId: result.id },
      });
      return result;
    });
    return Response.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
