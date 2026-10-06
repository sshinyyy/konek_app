import { randomBytes } from "node:crypto";
import { DocumentType } from "@prisma/client";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession, isStaff } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";

const schema = z.object({
  type: z.enum(["BARANGAY_CLEARANCE", "CERTIFICATE_OF_RESIDENCY", "BARANGAY_ID"]),
  purpose: z.string().trim().min(3).max(500),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    const requests = await withRlsContext(session, (tx) =>
      tx.documentRequest.findMany({
        where: isStaff(session) ? undefined : { residentId: session.userId },
        include: {
          uploads: { select: { id: true, fileName: true, status: true, sizeBytes: true } },
          document: { select: { referenceNo: true, issuedAt: true, validUntil: true } },
          resident: { include: { profile: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 100,
      }),
    );
    return Response.json({
      requests: requests.map((request) => ({
        id: request.id,
        referenceNo: request.referenceNo,
        type: request.type,
        status: request.status,
        purpose: request.purpose,
        remarks: request.remarks,
        submittedAt: request.submittedAt,
        uploads: request.uploads,
        document: request.document,
        ...(isStaff(session) && request.resident.profile
          ? {
              resident: {
                id: request.resident.id,
                email: request.resident.email,
                fullName: decrypt(request.resident.profile.fullNameEncrypted),
                dateOfBirth: decrypt(request.resident.profile.dateOfBirthEncrypted),
                address: decrypt(request.resident.profile.addressEncrypted),
                phone: decrypt(request.resident.profile.phoneEncrypted),
                civilStatus: decrypt(request.resident.profile.civilStatusEncrypted),
              },
            }
          : {}),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    if (session.role !== "RESIDENT") throw new ApiError(403, "Only residents can submit requests.");
    const parsed = schema.safeParse(await request.json());
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
