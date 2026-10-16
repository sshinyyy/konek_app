import { ApiError, assertSameOrigin, errorResponse, readJson } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { decrypt, encrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";
import { residentProfileSchema } from "@/lib/resident-profile-schema";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    if (session.role !== UserRole.RESIDENT) throw new ApiError(403, "Resident access required.");
    const profile = await withRlsContext(session, (tx) =>
      tx.residentProfile.findUnique({ where: { userId: session.userId } }),
    );
    if (!profile) throw new ApiError(404, "Resident profile not found.");
    return Response.json({
      fullName: decrypt(profile.fullNameEncrypted),
      dateOfBirth: decrypt(profile.dateOfBirthEncrypted),
      address: decrypt(profile.addressEncrypted),
      phone: decrypt(profile.phoneEncrypted),
      civilStatus: decrypt(profile.civilStatusEncrypted),
      gender: profile.genderEncrypted ? decrypt(profile.genderEncrypted) : "",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    if (session.role !== UserRole.RESIDENT) throw new ApiError(403, "Resident access required.");
    const parsed = residentProfileSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Please check your profile details.");
    const value = parsed.data;
    const profile = await withRlsContext(session, (tx) =>
      tx.residentProfile.update({
        where: { userId: session.userId },
        data: {
          fullNameEncrypted: encrypt(value.fullName),
          dateOfBirthEncrypted: encrypt(value.dateOfBirth),
          addressEncrypted: encrypt(value.address),
          phoneEncrypted: encrypt(value.phone),
          civilStatusEncrypted: encrypt(value.civilStatus),
          genderEncrypted: encrypt(value.gender),
        },
        select: { updatedAt: true },
      }),
    );
    return Response.json({ updatedAt: profile.updatedAt });
  } catch (error) {
    return errorResponse(error);
  }
}
