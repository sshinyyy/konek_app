import { describe, expect, it } from "vitest";
import { residentProfileSchema } from "@/lib/resident-profile-schema";

const validProfile = {
  fullName: "Jordan Resident",
  dateOfBirth: "1990-04-12",
  address: "12 Barangay Road",
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
});
