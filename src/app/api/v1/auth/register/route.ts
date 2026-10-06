import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { assertSameOrigin, ApiError, errorResponse } from "@/lib/api";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  email: z.email().max(320),
  password: z.string().min(12).max(128),
  fullName: z.string().trim().min(2).max(150),
  dateOfBirth: z.iso.date(),
  address: z.string().trim().min(6).max(300),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  civilStatus: z.enum(["Single", "Married", "Widowed", "Separated"]),
  privacyAcknowledged: z.literal(true),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Please check your registration details.");
    const input = parsed.data;
    const email = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.$transaction(async (transaction) => {
      const userId = randomUUID();
      await transaction.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      await transaction.$executeRaw`SELECT set_config('app.current_user_role', ${UserRole.RESIDENT}, true)`;
      const createdUser = await transaction.user.create({
        data: {
          id: userId,
          email,
          passwordHash,
          role: UserRole.RESIDENT,
          privacyNoticeAcceptedAt: new Date(),
          privacyNoticeVersion: "2026-10-v1",
        },
        select: { id: true, email: true, role: true },
      });
      await transaction.residentProfile.create({
        data: {
          userId: createdUser.id,
          fullNameEncrypted: encrypt(input.fullName),
          dateOfBirthEncrypted: encrypt(input.dateOfBirth),
          addressEncrypted: encrypt(input.address),
          phoneEncrypted: encrypt(input.phone),
          civilStatusEncrypted: encrypt(input.civilStatus),
        },
      });
      await transaction.auditLog.create({
        data: { actorId: createdUser.id, action: "RESIDENT_REGISTERED", entity: "User", entityId: createdUser.id },
      });
      return createdUser;
    });
    const token = await createSessionToken({ userId: user.id, email: user.email, role: user.role });
    const response = NextResponse.json({ id: user.id, email: user.email, role: user.role }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse(new ApiError(409, "An account with this email already exists."));
    }
    return errorResponse(error);
  }
}
