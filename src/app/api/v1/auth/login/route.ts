import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { assertSameOrigin, ApiError, errorResponse } from "@/lib/api";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";

const schema = z.object({ email: z.email().max(320), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and password.");
    const email = parsed.data.email.trim().toLowerCase();
    const user = await withRlsContext(
      { userId: "00000000-0000-0000-0000-000000000000", email, role: UserRole.RESIDENT },
      async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.login_email', ${email}, true)`;
        return transaction.user.findUnique({ where: { email } });
      },
    );
    if (!user || !user.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      throw new ApiError(401, "Email or password is incorrect.");
    }
    const session = { userId: user.id, email: user.email, role: user.role };
    await withRlsContext(session, (tx) =>
      tx.auditLog.create({
        data: { actorId: user.id, action: "USER_LOGIN", entity: "User", entityId: user.id },
      }),
    );
    const token = await createSessionToken(session);
    const response = NextResponse.json({ id: user.id, email: user.email, role: user.role });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
