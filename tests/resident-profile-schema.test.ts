import { describe, expect, it } from "vitest";
import { formatResidentAddress, formatResidentName, residentProfileSchema } from "@/lib/resident-profile-schema";

const validProfile = {
  firstName: "Jordan",
  middleName: "Q",
  lastName: "Resident",
  dateOfBirth: "1990-04-12",
  houseNumber: "12",
  street: "Barangay Road",
  purokSitio: "Purok 1",
  barangay: "Banonong",
  cityMunicipality: "Dapitan City",
  province: "Zamboanga del Norte",
  postalCode: "7101",
  phone: "+63 912 345 6789",
  civilStatus: "Single",
};

describe("resident profile schema", () => {
  it.each(["Male", "Female"])("accepts %s as a gender choice", (gender) => {
    expect(residentProfileSchema.safeParse({ ...validProfile, gender }).success).toBe(true);
  });

  it("requires a supported gender choice", () => {
    expect(residentProfileSchema.safeParse({ ...validProfile, gender: "" }).success).toBe(false);
    expect(residentProfileSchema.safeParse({ ...validProfile, gender: "Other" }).success).toBe(false);
  });

  it("requires specific address components and a four-digit postal code", () => {
    expect(residentProfileSchema.safeParse({ ...validProfile, gender: "Male", street: "" }).success).toBe(false);
    expect(residentProfileSchema.safeParse({ ...validProfile, gender: "Male", postalCode: "710" }).success).toBe(false);
  });

  it("formats the entered name and detailed address for existing document workflows", () => {
    expect(formatResidentName(validProfile)).toBe("Jordan Q Resident");
    expect(formatResidentAddress(validProfile)).toBe(
      "12, Barangay Road, Purok 1, Barangay Banonong, Dapitan City, Zamboanga del Norte 7101",
    );
  });
});
