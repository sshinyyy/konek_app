import { UserRole } from "@prisma/client";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";
import { objectExists } from "@/lib/storage";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  municipality: z.string().trim().min(2).max(120),
  province: z.string().trim().min(2).max(120),
  captainName: z.string().trim().max(150).nullable(),
  officeAddress: z.string().trim().max(300).nullable(),
  contactNumber: z.string().trim().max(30).nullable(),
  certificateValidityDays: z.number().int().min(1).max(3650),
  sealObjectKey: z.string().nullable(),
  signatureObjectKey: z.string().nullable(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (session?.role !== UserRole.ADMIN) throw new ApiError(403, "System administrator access required.");
    const settings = await withRlsContext(session, (tx) =>
      tx.barangaySettings.findUnique({ where: { id: 1 } }),
    );
    if (!settings) throw new ApiError(500, "Barangay settings have not been initialized.");
    return Response.json(settings);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (session?.role !== UserRole.ADMIN) throw new ApiError(403, "System administrator access required.");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Please check the barangay settings.");
    const input = parsed.data;
    for (const [key, prefix] of [
      [input.sealObjectKey, "settings/seal/"],
      [input.signatureObjectKey, "settings/signature/"],
    ] as const) {
      if (key && (!key.startsWith(prefix) || !(await objectExists(key)))) {
        throw new ApiError(400, "A certificate image could not be verified in secure storage.");
      }
    }
    const settings = await withRlsContext(session, async (tx) => {
      const updated = await tx.barangaySettings.update({ where: { id: 1 }, data: input });
      await tx.auditLog.create({
        data: { actorId: session.userId, action: "BARANGAY_SETTINGS_UPDATED", entity: "BarangaySettings" },
      });
      return updated;
    });
    return Response.json(settings);
  } catch (error) {
    return errorResponse(error);
  }
}
