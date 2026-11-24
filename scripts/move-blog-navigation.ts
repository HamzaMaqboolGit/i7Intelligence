import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { prisma } = await import("../lib/prisma");
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    const rows = await tx.navigationItem.findMany({
      where: { deletedAt: null },
    });
    for (const placement of ["header", "mobile"]) {
      const items = rows.filter(
        (r) =>
          ((r.data as Record<string, string>).placement || "header") ===
          placement,
      );
      const about = items.find(
        (r) => (r.data as Record<string, string>).url === "/about",
      );
      if (!about) continue;
      for (const blog of items.filter(
        (r) => (r.data as Record<string, string>).url === "/blog",
      )) {
        const data = blog.data as Record<string, string>;
        if (data.parent !== about.title) {
          await tx.navigationItem.update({
            where: { id: blog.id },
            data: { data: { ...data, parent: about.title } },
          });
          changed++;
        }
      }
    }
    await tx.activityLog.create({
      data: {
        action: "updated",
        entity: "navigation",
        description: "Moved Blog into About dropdown for public navigation",
      },
    });
  });
  console.log(
    `Updated ${changed} Blog navigation item(s); footer and routes preserved.`,
  );
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
