import type { UserRole } from "@prisma/client";

export function canAccessSupportingDocument(
  userId: string,
  ownerId: string,
  role: UserRole,
): boolean {
  return role === "STAFF" || role === "ADMIN" || userId === ownerId;
}
