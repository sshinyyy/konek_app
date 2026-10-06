/* eslint @typescript-eslint/no-require-imports: "off" */
const bcrypt = require("bcryptjs");
const { PrismaClient, UserRole } = require("@prisma/client");

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password || password.length < 16) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD (at least 16 characters) before seeding.");
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    console.info(`Administrator ${email} already exists; no credentials were changed.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.ADMIN,
    },
  });
  console.info(`Created the initial administrator account for ${email}.`);
}

main()
  .catch((error) => {
    console.error("Administrator bootstrap failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
