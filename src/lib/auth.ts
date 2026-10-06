import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { SESSION_COOKIE, type Session, verifySessionToken } from "@/lib/session-token";

export { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/session-token";
export type { Session } from "@/lib/session-token";

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export function isStaff(session: Session): boolean {
  return session.role === UserRole.STAFF || session.role === UserRole.ADMIN;
}
