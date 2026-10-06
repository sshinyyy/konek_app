import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";

const schema = z.object({
  fullName: z.string().trim().min(2).max(150),
  dateOfBirth: z.iso.date(),
  address: z.string().trim().min(6).max(300),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  civilStatus: z.enum(["Single", "Married", "Widowed", "Separated"]),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
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
    const parsed = schema.safeParse(await request.json());
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
        },
        select: { updatedAt: true },
      }),
    );
    return Response.json({ updatedAt: profile.updatedAt });
  } catch (error) {
    return errorResponse(error);
  }
}
