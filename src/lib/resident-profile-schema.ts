import { z } from "zod";

export const residentProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  dateOfBirth: z.iso.date(),
  address: z.string().trim().min(6).max(300),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  civilStatus: z.enum(["Single", "Married", "Widowed", "Separated"]),
  gender: z.enum(["Male", "Female"]),
});
