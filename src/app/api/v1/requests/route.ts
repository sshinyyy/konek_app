import { randomBytes } from "node:crypto";
import { DocumentType } from "@prisma/client";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse, readJson } from "@/lib/api";
import { getSession, isStaff } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";
import { parseRequestPage, REQUEST_PAGE_SIZE } from "@/lib/request-pagination";

const schema = z.object({
  type: z.enum(["BARANGAY_CLEARANCE", "CERTIFICATE_OF_RESIDENCY", "BARANGAY_ID"]),
  purpose: z.string().trim().min(3).max(500),
});
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    const page = parseRequestPage(new URL(request.url).searchParams.get("page"));
    const where = isStaff(session) ? undefined : { residentId: session.userId };
    const requests = await withRlsContext(session, async (tx) => {
      const include = {
        uploads: { select: { id: true, fileName: true, status: true, sizeBytes: true } },
        document: { select: { referenceNo: true, issuedAt: true, validUntil: true } },
      };
      const pagination = {
        orderBy: [{ submittedAt: "desc" as const }, { id: "desc" as const }],
        skip: page * REQUEST_PAGE_SIZE,
        take: REQUEST_PAGE_SIZE + 1,
      };
      const [statusCounts, totalCount] = await Promise.all([
        tx.documentRequest.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),
        tx.documentRequest.count({ where }),
      ]);
      const counts = Object.fromEntries(
        statusCounts.map(({ status, _count }) => [status, _count._all]),
      );
      if (isStaff(session)) {
        const staffRequests = await tx.documentRequest.findMany({
          include: {
            ...include,
            resident: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    fullNameEncrypted: true,
                    dateOfBirthEncrypted: true,
                    addressEncrypted: true,
                    phoneEncrypted: true,
                    civilStatusEncrypted: true,
                  },
                },
              },
            },
          },
          ...pagination,
        });
        const hasMore = staffRequests.length > REQUEST_PAGE_SIZE;
        return {
          requests: staffRequests.slice(0, REQUEST_PAGE_SIZE).map((request) => ({
            id: request.id,
            referenceNo: request.referenceNo,
            type: request.type,
            status: request.status,
            purpose: request.purpose,
            remarks: request.remarks,
            submittedAt: request.submittedAt,
            uploads: request.uploads,
            document: request.document,
            ...(request.resident.profile
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
          counts,
          totalCount,
          nextPage: hasMore ? page + 1 : null,
        };
      }

      const residentRequests = await tx.documentRequest.findMany({
        where,
        include,
        ...pagination,
      });
      const hasMore = residentRequests.length > REQUEST_PAGE_SIZE;
      return {
        requests: residentRequests.slice(0, REQUEST_PAGE_SIZE).map((request) => ({
          id: request.id,
          referenceNo: request.referenceNo,
          type: request.type,
          status: request.status,
          purpose: request.purpose,
          remarks: request.remarks,
          submittedAt: request.submittedAt,
          uploads: request.uploads,
          document: request.document,
        })),
        counts,
        totalCount,
        nextPage: hasMore ? page + 1 : null,
      };
    });
    return Response.json(requests);
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
