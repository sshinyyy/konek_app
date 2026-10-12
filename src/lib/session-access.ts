import type { UserRole } from "@prisma/client";
import type { Session } from "@/lib/session-token";

export function sessionMatchesActiveAccount(
  session: Session,
  account: { email: string; role: UserRole; isActive: boolean } | null,
): account is { email: string; role: UserRole; isActive: true } {
  return Boolean(account?.isActive && account.role === session.role);
}

export function roleCanAccessPath(role: UserRole, pathname: string): boolean {
  const staffPath =
    pathname === "/staff" ||
    /^\/api\/v1\/requests\/[^/]+\/decision\/?$/.test(pathname);
  if (staffPath && role !== "STAFF" && role !== "ADMIN") return false;
  if (pathname === "/admin" && role !== "ADMIN") return false;
  return true;
}
