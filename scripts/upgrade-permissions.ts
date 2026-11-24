import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { prisma } = await import("../lib/prisma");
  const { permissionKeys } = await import("../lib/cms/registry");
  for (const key of permissionKeys)
    await prisma.permission.upsert({
      where: { key },
      create: { key },
      update: {},
    });
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
  });
  for (const role of roles) {
    const existing = role.permissions.map((p) => p.permission.key);
    const keys =
      role.name === "Super Admin"
        ? permissionKeys
        : existing
            .filter((k) => k.endsWith(":write"))
            .flatMap((k) =>
              ["create", "edit", "publish"].map(
                (a) => `${k.split(":")[0]}:${a}`,
              ),
            );
    for (const key of keys) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }
  console.log(
    "Existing role grants extended with explicit create/edit/publish permissions; no grants removed.",
  );
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
