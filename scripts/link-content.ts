import { PrismaClient } from "@prisma/client";
import { slugify } from "../lib/cms/registry";
try {
  process.loadEnvFile(".env.local");
} catch {}
const p = new PrismaClient();
async function main() {
  const home = await p.page.findUniqueOrThrow({ where: { slug: "home" } });
  await p.pageSection.updateMany({
    where: { pageId: null },
    data: { pageId: home.id },
  });
  for (const post of await p.blogPost.findMany({
    where: { deletedAt: null },
  })) {
    const category = (post.data as { category?: string }).category;
    if (!category) continue;
    const row = await p.blogCategory.upsert({
      where: { slug: slugify(category) },
      update: {},
      create: {
        slug: slugify(category),
        title: category,
        status: "published",
        data: {},
      },
    });
    await p.blogPost.update({
      where: { id: post.id },
      data: { categoryId: row.id },
    });
  }
  console.log(
    "Existing page sections and blog categories linked without replacing content.",
  );
}
main().finally(() => p.$disconnect());
