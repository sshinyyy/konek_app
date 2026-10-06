import type { UserRole } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "konekbrgy_session";
export const SESSION_TTL_SECONDS = 15 * 60;

export type Session = {
  userId: string;
  email: string;
  role: UserRole;
};

function signingKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ email: session.email, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(signingKey());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      !["RESIDENT", "STAFF", "ADMIN"].includes(payload.role)
    ) {
      return null;
    }
    return { userId: payload.sub, email: payload.email, role: payload.role as UserRole };
  } catch {
    return null;
  }
}
