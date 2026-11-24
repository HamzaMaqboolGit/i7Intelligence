import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { prisma } = await import("../lib/prisma");
  const parent = await prisma.navigationItem.findFirst({
    where: { slug: "about", deletedAt: null },
  });
  if (parent) {
    for (const [i, slug] of ["team", "careers"].entries()) {
      const existing = await prisma.navigationItem.findFirst({
        where: { deletedAt: null, data: { path: "$.url", equals: `/${slug}` } },
      });
      if (!existing)
        await prisma.navigationItem.create({
          data: {
            title: slug === "team" ? "Team" : "Careers",
            slug: `header-${slug}`,
            sortOrder: parent.sortOrder + i + 1,
            status: "published",
            data: {
              url: `/${slug}`,
              placement: "header",
              parent: parent.title,
              newTab: false,
            },
          },
        });
    }
  }
  console.log(
    "Preserved existing About dropdown as database-managed Team and Careers links.",
  );
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
