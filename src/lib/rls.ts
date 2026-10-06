import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/auth";

export async function withRlsContext<T>(
  session: Session,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.current_user_id', ${session.userId}, true)`;
    await transaction.$executeRaw`SELECT set_config('app.current_user_role', ${session.role}, true)`;
    return operation(transaction);
  });
}
