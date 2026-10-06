import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, errorResponse } from "@/lib/api";
import { decrypt, sha256 } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/);

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!schema.safeParse(token).success) {
      return Response.json({ authentic: false, message: "Invalid or forged document." });
    }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const salt = process.env.IP_HASH_SALT;
    if (!salt || salt.length < 32) {
      throw new ApiError(503, "Document verification is temporarily unavailable.");
    }
    const ipHash = createHash("sha256").update(`${salt}:${ip}`).digest("hex");
    const rows = await prisma.$queryRaw<
      Array<{
        authentic: boolean;
        referenceNo: string | null;
        documentType: string | null;
        recipientNameEncrypted: string | null;
        issuedAt: Date | null;
        validUntil: Date | null;
      }>
    >`SELECT * FROM verify_issued_document(
      ${sha256(token)}::char(64),
      ${request.headers.get("user-agent") ?? ""}::text,
      ${ipHash}::char(64)
    )`;
    const result = rows[0];
    if (!result) throw new Error("The document verification function returned no result");
    if (!result.authentic) {
      return Response.json({ authentic: false, message: "Invalid, forged, expired, or revoked document." });
    }
    return Response.json({
      authentic: true,
      referenceNo: result.referenceNo,
      documentType: result.documentType,
      recipientName: decrypt(result.recipientNameEncrypted ?? ""),
      issuedAt: result.issuedAt,
      validUntil: result.validUntil,
      message: "Authentic document.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
