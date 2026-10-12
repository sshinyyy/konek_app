import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { SESSION_COOKIE, type Session, verifySessionToken } from "@/lib/session-token";
import { sessionMatchesActiveAccount } from "@/lib/session-access";
import { withRlsContext } from "@/lib/rls";

export { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/session-token";
export type { Session } from "@/lib/session-token";

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null;

  const activeUser = await withRlsContext(session, (transaction) =>
    transaction.user.findUnique({
      where: { id: session.userId },
      select: { email: true, role: true, isActive: true },
    }),
  );
  if (!sessionMatchesActiveAccount(session, activeUser)) return null;
  return { ...session, email: activeUser.email };
}

export function isStaff(session: Session): boolean {
  return session.role === UserRole.STAFF || session.role === UserRole.ADMIN;
}
