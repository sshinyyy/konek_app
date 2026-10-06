import { UserRole } from "@prisma/client";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";

const schema = z.object({
  fullName: z.string().trim().min(2).max(150),
  jobTitle: z.string().trim().min(2).max(150),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== UserRole.STAFF && session.role !== UserRole.ADMIN)) {
      throw new ApiError(403, "Staff access required.");
    }

    const profile = await withRlsContext(session, (tx) =>
      tx.staffProfile.findUnique({ where: { userId: session.userId } }),
    );

    return Response.json({
      fullName: profile ? decrypt(profile.fullNameEncrypted) : "",
      jobTitle: profile?.jobTitle ?? "",
      phone: profile ? decrypt(profile.phoneEncrypted) : "",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (!session || (session.role !== UserRole.STAFF && session.role !== UserRole.ADMIN)) {
      throw new ApiError(403, "Staff access required.");
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Check the name, job title, and contact number.");
    const profile = parsed.data;

    await withRlsContext(session, async (tx) => {
      await tx.staffProfile.upsert({
        where: { userId: session.userId },
        create: {
          userId: session.userId,
          fullNameEncrypted: encrypt(profile.fullName),
          jobTitle: profile.jobTitle,
          phoneEncrypted: encrypt(profile.phone),
        },
        update: {
          fullNameEncrypted: encrypt(profile.fullName),
          jobTitle: profile.jobTitle,
          phoneEncrypted: encrypt(profile.phone),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: "STAFF_PROFILE_UPDATED",
          entity: "StaffProfile",
          entityId: session.userId,
        },
      });
    });

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
