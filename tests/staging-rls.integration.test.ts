import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";
import type { Session } from "@/lib/session-token";

const runStagingTests = process.env.RUN_STAGING_RLS_TESTS === "true";
const stagingDescribe = runStagingTests ? describe : describe.skip;

stagingDescribe("non-production PostgreSQL row-level security", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("isolates resident profiles and accounts between residents", async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must point to the confirmed non-production database.");
    }

    const residentIds = [randomUUID(), randomUUID()];
    const residentSessions: Session[] = residentIds.map((userId) => ({
      userId,
      email: `rls-${userId}@example.test`,
      role: "RESIDENT",
    }));
    const adminSession: Session = {
      userId: randomUUID(),
      email: "rls-test-admin@example.test",
      role: "ADMIN",
    };

    try {
      await withRlsContext(adminSession, async (tx) => {
        await tx.user.createMany({
          data: residentSessions.map((session) => ({
            id: session.userId,
            email: session.email,
            passwordHash: "integration-test-only",
            role: "RESIDENT",
          })),
        });
      });

      for (const [index, session] of residentSessions.entries()) {
        await withRlsContext(session, (tx) =>
          tx.residentProfile.create({
            data: {
              userId: session.userId,
              fullNameEncrypted: encrypt(`Synthetic Resident ${index}`),
              dateOfBirthEncrypted: encrypt("1990-01-01"),
              addressEncrypted: encrypt(`Synthetic Address ${index}`),
              phoneEncrypted: encrypt("0000000000"),
              civilStatusEncrypted: encrypt("Single"),
            },
          }),
        );
      }

      const visibleAccount = await withRlsContext(residentSessions[0], (tx) =>
        tx.user.findUnique({ where: { id: residentIds[0] }, select: { id: true } }),
      );
      const hiddenAccount = await withRlsContext(residentSessions[0], (tx) =>
        tx.user.findUnique({ where: { id: residentIds[1] }, select: { id: true } }),
      );
      const visibleProfile = await withRlsContext(residentSessions[0], (tx) =>
        tx.residentProfile.findUnique({
          where: { userId: residentIds[0] },
          select: { userId: true },
        }),
      );
      const hiddenProfile = await withRlsContext(residentSessions[0], (tx) =>
        tx.residentProfile.findUnique({
          where: { userId: residentIds[1] },
          select: { userId: true },
        }),
      );

      expect(visibleAccount?.id).toBe(residentIds[0]);
      expect(hiddenAccount).toBeNull();
      expect(visibleProfile?.userId).toBe(residentIds[0]);
      expect(hiddenProfile).toBeNull();

      const requestIndexes = await withRlsContext(adminSession, (tx) =>
        tx.$queryRaw<{ indexname: string }[]>`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname IN (
              'DocumentRequest_residentId_submittedAt_id_idx',
              'DocumentRequest_submittedAt_id_idx'
            )
        `,
      );
      expect(requestIndexes.map(({ indexname }) => indexname).sort()).toEqual([
        "DocumentRequest_residentId_submittedAt_id_idx",
        "DocumentRequest_submittedAt_id_idx",
      ]);
    } finally {
      await withRlsContext(adminSession, async (tx) => {
        await tx.residentProfile.deleteMany({ where: { userId: { in: residentIds } } });
        await tx.user.deleteMany({ where: { id: { in: residentIds } } });
      });
    }
  });
});
