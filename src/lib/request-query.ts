import { UserRole } from "@prisma/client";
import { decrypt } from "@/lib/crypto";
import type { Session } from "@/lib/session-token";
import { withRlsContext } from "@/lib/rls";
import { REQUEST_PAGE_SIZE } from "@/lib/request-pagination";

export type RequestPageData = {
  requests: {
    id: string;
    referenceNo: string;
    type: "BARANGAY_CLEARANCE" | "CERTIFICATE_OF_RESIDENCY" | "BARANGAY_ID";
    status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "ISSUED";
    purpose: string;
    remarks: string | null;
    submittedAt: string;
    uploads: { id: string; fileName: string; status: string; sizeBytes: number }[];
    document: { referenceNo: string; issuedAt: string; validUntil: string | null } | null;
    resident?: {
      id: string;
      email: string;
      fullName: string;
      dateOfBirth: string;
      address: string;
      phone: string;
      civilStatus: string;
    };
  }[];
  counts?: Record<string, number>;
  totalCount?: number;
  nextPage: number | null;
};

function serializeRequest(request: {
  id: string;
  referenceNo: string;
  type: "BARANGAY_CLEARANCE" | "CERTIFICATE_OF_RESIDENCY" | "BARANGAY_ID";
  status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "ISSUED";
  purpose: string;
  remarks: string | null;
  submittedAt: Date;
  uploads: { id: string; fileName: string; status: string; sizeBytes: number }[];
  document: { referenceNo: string; issuedAt: Date; validUntil: Date | null } | null;
}) {
  return {
    id: request.id,
    referenceNo: request.referenceNo,
    type: request.type,
    status: request.status,
    purpose: request.purpose,
    remarks: request.remarks,
    submittedAt: request.submittedAt.toISOString(),
    uploads: request.uploads,
    document: request.document
      ? {
          referenceNo: request.document.referenceNo,
          issuedAt: request.document.issuedAt.toISOString(),
          validUntil: request.document.validUntil?.toISOString() ?? null,
        }
      : null,
  };
}

export async function getRequestPage(
  session: Session,
  page: number,
  includeSummary = true,
): Promise<RequestPageData> {
  return withRlsContext(session, async (tx) => {
    const where = session.role === UserRole.STAFF || session.role === UserRole.ADMIN
      ? undefined
      : { residentId: session.userId };
    const include = {
      uploads: { select: { id: true, fileName: true, status: true, sizeBytes: true } },
      document: { select: { referenceNo: true, issuedAt: true, validUntil: true } },
    };
    const pagination = {
      orderBy: [{ submittedAt: "desc" as const }, { id: "desc" as const }],
      skip: page * REQUEST_PAGE_SIZE,
      take: REQUEST_PAGE_SIZE + 1,
    };
    const statusCounts = includeSummary
      ? await tx.documentRequest.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        })
      : null;
    const summaryFields = statusCounts
      ? {
          counts: Object.fromEntries(
            statusCounts.map(({ status, _count }) => [status, _count._all]),
          ),
          totalCount: statusCounts.reduce((total, { _count }) => total + _count._all, 0),
        }
      : {};

    if (session.role === UserRole.STAFF || session.role === UserRole.ADMIN) {
      const requests = await tx.documentRequest.findMany({
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
      const hasMore = requests.length > REQUEST_PAGE_SIZE;
      return {
        requests: requests.slice(0, REQUEST_PAGE_SIZE).map((request) => ({
          ...serializeRequest(request),
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
        ...summaryFields,
        nextPage: hasMore ? page + 1 : null,
      };
    }

    const requests = await tx.documentRequest.findMany({ where, include, ...pagination });
    const hasMore = requests.length > REQUEST_PAGE_SIZE;
    return {
      requests: requests.slice(0, REQUEST_PAGE_SIZE).map(serializeRequest),
      ...summaryFields,
      nextPage: hasMore ? page + 1 : null,
    };
  });
}
