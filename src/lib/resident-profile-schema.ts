import { z } from "zod";

export const residentIdentityAddressSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80),
  lastName: z.string().trim().min(1).max(80),
  houseNumber: z.string().trim().min(1).max(80),
  street: z.string().trim().min(2).max(120),
  purokSitio: z.string().trim().min(2).max(100),
  barangay: z.string().trim().min(2).max(100),
  cityMunicipality: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().regex(/^\d{4}$/),
});

export const residentProfileSchema = residentIdentityAddressSchema.extend({
  dateOfBirth: z.iso.date(),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  civilStatus: z.enum(["Single", "Married", "Widowed", "Separated"]),
  gender: z.enum(["Male", "Female"]),
});

export function formatResidentName(value: Pick<z.infer<typeof residentIdentityAddressSchema>, "firstName" | "middleName" | "lastName">) {
  return [value.firstName, value.middleName, value.lastName].filter(Boolean).join(" ");
}

export function formatResidentAddress(value: z.infer<typeof residentIdentityAddressSchema>) {
  return [
    value.houseNumber,
    value.street,
    value.purokSitio,
    `Barangay ${value.barangay}`,
    value.cityMunicipality,
    `${value.province} ${value.postalCode}`,
  ].join(", ");
}
