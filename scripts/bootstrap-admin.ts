import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
try {
  process.loadEnvFile(".env.local");
} catch {}
const prisma = new PrismaClient();
async function main() {
  if (await prisma.user.count())
    throw new Error(
      "Bootstrap is disabled: an administrator already exists. Use Admin Users instead.",
    );
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME || "Administrator";
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD (12+ characters) in the process environment.",
    );
  const role = await prisma.role.findUniqueOrThrow({
    where: { name: "Super Admin" },
  });
  const id = randomUUID();
  const encoded = await hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.$transaction(
    async (tx) => {
      if (await tx.user.count())
        throw new Error(
          "An administrator already exists; bootstrap is disabled.",
        );
      await tx.user.create({
        data: {
          id,
          name,
          email: email.toLowerCase(),
          emailVerified: true,
          roles: { create: { roleId: role.id } },
          accounts: {
            create: {
              id: randomUUID(),
              accountId: id,
              providerId: "credential",
              password: encoded,
            },
          },
        },
      });
      await tx.activityLog.create({
        data: {
          userId: id,
          action: "bootstrap",
          entity: "users",
          entityId: id,
          description: "First administrator created through CLI",
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  console.log(
    "First administrator created. Public registration remains disabled.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
