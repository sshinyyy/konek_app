import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";

const schema = z.object({
  email: z.email().max(320),
  password: z.string().min(12).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),
});

export async function GET() {
  try {
    const session = await getSession();
    if (session?.role !== UserRole.ADMIN) throw new ApiError(403, "System administrator access required.");
    const staff = await withRlsContext(session, (tx) =>
      tx.user.findMany({
        where: { role: UserRole.STAFF },
        select: { id: true, email: true, isActive: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    );
    return Response.json({ staff });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession();
    if (session?.role !== UserRole.ADMIN) throw new ApiError(403, "System administrator access required.");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and a 12-character password with a number.");
    const email = parsed.data.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const staff = await withRlsContext(session, async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.STAFF,
        },
        select: { id: true, email: true, isActive: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: { actorId: session.userId, action: "STAFF_ACCOUNT_CREATED", entity: "User", entityId: created.id },
      });
      return created;
    });
    return Response.json(staff, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse(new ApiError(409, "An account with this email already exists."));
    }
    return errorResponse(error);
  }
}
