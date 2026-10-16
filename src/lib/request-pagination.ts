import { z } from "zod";
import { ApiError } from "@/lib/api";

export const REQUEST_PAGE_SIZE = 50;

const pageSchema = z.coerce.number().int().min(0).max(100_000);

export function parseRequestPage(value: string | null): number {
  const parsed = pageSchema.safeParse(value ?? 0);
  if (!parsed.success) throw new ApiError(400, "Invalid request page.");
  return parsed.data;
}
