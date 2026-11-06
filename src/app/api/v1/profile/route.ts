import { ApiError, assertSameOrigin, errorResponse, readJson } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { decrypt, encrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";
import { formatResidentAddress, formatResidentName, residentProfileSchema } from "@/lib/resident-profile-schema";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    if (session.role !== UserRole.RESIDENT) throw new ApiError(403, "Resident access required.");
    const profile = await withRlsContext(session, (tx) =>
      tx.residentProfile.findUnique({ where: { userId: session.userId } }),
    );
    if (!profile) throw new ApiError(404, "Resident profile not found.");
    const fullName = decrypt(profile.fullNameEncrypted);
    const nameParts = fullName.trim().split(/\s+/);
    const hasStructuredName = Boolean(profile.firstNameEncrypted && profile.lastNameEncrypted);
    const hasStructuredAddress = Boolean(profile.houseNumberEncrypted);
    return Response.json({
      firstName: hasStructuredName ? decrypt(profile.firstNameEncrypted ?? "") : nameParts[0] ?? "",
      middleName: hasStructuredName ? decrypt(profile.middleNameEncrypted ?? "") : nameParts.slice(1, -1).join(" "),
      lastName: profile.lastNameEncrypted
        ? decrypt(profile.lastNameEncrypted)
        : nameParts.length > 1 ? nameParts[nameParts.length - 1] : "",
      dateOfBirth: decrypt(profile.dateOfBirthEncrypted),
      address: decrypt(profile.addressEncrypted),
      houseNumber: hasStructuredAddress ? decrypt(profile.houseNumberEncrypted ?? "") : "",
      street: hasStructuredAddress ? decrypt(profile.streetEncrypted ?? "") : "",
      purokSitio: hasStructuredAddress ? decrypt(profile.purokSitioEncrypted ?? "") : "",
      barangay: hasStructuredAddress ? decrypt(profile.barangayEncrypted ?? "") : "",
      cityMunicipality: hasStructuredAddress ? decrypt(profile.cityMunicipalityEncrypted ?? "") : "",
      province: hasStructuredAddress ? decrypt(profile.provinceEncrypted ?? "") : "",
      postalCode: hasStructuredAddress ? decrypt(profile.postalCodeEncrypted ?? "") : "",
      phone: decrypt(profile.phoneEncrypted),
      civilStatus: decrypt(profile.civilStatusEncrypted),
      gender: profile.genderEncrypted ? decrypt(profile.genderEncrypted) : "",
      legacyAddress: hasStructuredAddress ? "" : decrypt(profile.addressEncrypted),
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
    const fullName = formatResidentName(value);
    const address = formatResidentAddress(value);
    const profile = await withRlsContext(session, (tx) =>
      tx.residentProfile.update({
        where: { userId: session.userId },
        data: {
          fullNameEncrypted: encrypt(fullName),
          dateOfBirthEncrypted: encrypt(value.dateOfBirth),
          addressEncrypted: encrypt(address),
          firstNameEncrypted: encrypt(value.firstName),
          middleNameEncrypted: encrypt(value.middleName),
          lastNameEncrypted: encrypt(value.lastName),
          houseNumberEncrypted: encrypt(value.houseNumber),
          streetEncrypted: encrypt(value.street),
          purokSitioEncrypted: encrypt(value.purokSitio),
          barangayEncrypted: encrypt(value.barangay),
          cityMunicipalityEncrypted: encrypt(value.cityMunicipality),
          provinceEncrypted: encrypt(value.province),
          postalCodeEncrypted: encrypt(value.postalCode),
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
