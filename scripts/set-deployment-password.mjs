import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
if (!process.argv.includes("--confirm-imported-database"))
  throw new Error(
    "This changes an imported deployment account. Run only on the intended Hostinger database with --confirm-imported-database.",
  );
const email = process.env.DEPLOYMENT_ADMIN_EMAIL?.trim().toLowerCase(),
  password = process.env.DEPLOYMENT_ADMIN_PASSWORD;
if (!email || !password || password.length < 16)
  throw new Error(
    "Load the private admin-setup.env file first (16+ character temporary password).",
  );
const db = new PrismaClient();
try {
  const user = await db.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });
  if (
    !user ||
    user.disabled ||
    !user.roles.some((r) => r.role.name === "Super Admin")
  )
    throw new Error(
      "The exact active imported Super Admin account was not found. No changes made.",
    );
  const account = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!account) throw new Error("Password account not found. No changes made.");
  const encoded = await hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await db.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: account.id },
      data: { password: encoded },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "deployment-password-reset",
        entity: "security",
        entityId: user.id,
        description:
          "Operator explicitly set an imported deployment password using CLI; MFA unchanged.",
      },
    });
  });
  console.log(
    "Imported deployment password updated; old sessions revoked. MFA remains unchanged. Sign in and choose your permanent password.",
  );
} finally {
  await db.$disconnect();
}
