import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse, readJson } from "@/lib/api";
import { getSession, isStaff } from "@/lib/auth";
import { decrypt, sha256 } from "@/lib/crypto";
import { renderCertificate } from "@/lib/document";
import { claimRequestTransition } from "@/lib/request-state";
import { withRlsContext } from "@/lib/rls";
import { deleteObject, uploadPdf } from "@/lib/storage";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("review") }),
  z.object({ action: z.literal("reject"), remarks: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("issue"), remarks: z.string().trim().max(1000).optional() }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    if (!isStaff(session)) throw new ApiError(403, "Staff access required.");
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Choose an action and provide the required review remarks.");
    const { id } = await context.params;

    if (parsed.data.action === "review") {
      const result = await withRlsContext(session, async (tx) => {
        await claimRequestTransition(tx, id, "review", { decidedById: session.userId });
        const updated = await tx.documentRequest.findUniqueOrThrow({
          where: { id },
          select: { referenceNo: true, status: true },
        });
        await tx.auditLog.create({
          data: { actorId: session.userId, action: "REQUEST_REVIEW_STARTED", entity: "DocumentRequest", entityId: id },
        });
        return updated;
      });
      return Response.json(result);
    }

    if (parsed.data.action === "reject") {
      const remarks = parsed.data.remarks;
      const updated = await withRlsContext(session, async (tx) => {
        await claimRequestTransition(tx, id, "reject", {
          remarks,
          decidedById: session.userId,
        });
        const result = await tx.documentRequest.findUniqueOrThrow({
          where: { id },
          select: { referenceNo: true, status: true, remarks: true },
        });
        await tx.auditLog.create({
          data: { actorId: session.userId, action: "REQUEST_REJECTED", entity: "DocumentRequest", entityId: id },
        });
        return result;
      });
      return Response.json(updated);
    }

    const remarks = parsed.data.remarks;
    const requestDetails = await withRlsContext(session, (tx) =>
      tx.documentRequest.findUnique({
        where: { id },
        include: { resident: { include: { profile: true } }, document: true },
      }),
    );
    if (!requestDetails) throw new ApiError(404, "Request not found.");
    if (requestDetails.status !== "PENDING" && requestDetails.status !== "IN_REVIEW") {
      throw new ApiError(409, "This request has already been processed.");
    }
    if (!requestDetails.resident.profile) throw new ApiError(409, "The resident profile is incomplete.");

    const issuedAt = new Date();
    const settings = await withRlsContext(session, (tx) =>
      tx.barangaySettings.findUnique({ where: { id: 1 } }),
    );
    if (!settings) throw new ApiError(500, "Barangay certificate settings have not been initialized.");
    const validUntil = new Date(issuedAt);
    validUntil.setDate(validUntil.getDate() + settings.certificateValidityDays);
    const token = randomBytes(32).toString("base64url");
    const publicUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_APP_URL;
    if (!publicUrl || (process.env.NODE_ENV === "production" && !publicUrl.startsWith("https://"))) {
      throw new Error("NEXT_PUBLIC_APP_URL must be configured as an HTTPS URL in production");
    }
    const verifyUrl = new URL(`/verify?token=${encodeURIComponent(token)}`, publicUrl).toString();
    const recipientName = decrypt(requestDetails.resident.profile.fullNameEncrypted);
    const address = decrypt(requestDetails.resident.profile.addressEncrypted);
    const { bytes, recipientNameEncrypted } = await renderCertificate({
      type: requestDetails.type,
      referenceNo: requestDetails.referenceNo,
      recipientName,
      address,
      purpose: requestDetails.purpose,
      issuedAt,
      validUntil,
      verifyUrl,
      barangayName: settings.name,
      municipality: settings.municipality,
      province: settings.province,
      captainName: settings.captainName ?? "Punong Barangay",
      sealObjectKey: settings.sealObjectKey,
      signatureObjectKey: settings.signatureObjectKey,
    });

    const documentId = randomUUID();
    const objectKey = `issued-documents/${documentId}.pdf`;
    await uploadPdf(objectKey, bytes);
    try {
      const result = await withRlsContext(session, async (tx) => {
        await claimRequestTransition(tx, id, "issue", {
          decidedById: session.userId,
          remarks: remarks?.trim() || null,
        });
        const issued = await tx.issuedDocument.create({
          data: {
            id: documentId,
            requestId: id,
            referenceNo: requestDetails.referenceNo,
            type: requestDetails.type,
            recipientNameEncrypted,
            issuedAt,
            validUntil,
            verificationHash: sha256(token),
            pdfObjectKey: objectKey,
          },
          select: { referenceNo: true, issuedAt: true, validUntil: true },
        });
        await tx.documentRequest.update({
          where: { id },
          data: { status: "ISSUED" },
        });
        await tx.auditLog.create({
          data: { actorId: session.userId, action: "DOCUMENT_ISSUED", entity: "DocumentRequest", entityId: id },
        });
        return issued;
      });
      return Response.json(result, { status: 201 });
    } catch (error) {
      try {
        await deleteObject(objectKey);
      } catch (cleanupError) {
        console.error("Could not remove an unregistered issued PDF", { documentId, cleanupError });
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
