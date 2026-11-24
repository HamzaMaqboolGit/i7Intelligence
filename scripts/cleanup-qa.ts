import { PrismaClient } from "@prisma/client";
import { modules } from "../lib/cms/registry";
try {
  process.loadEnvFile(".env.local");
} catch {}
const p = new PrismaClient();
async function main() {
  for (const model of [
    ...new Set(Object.values(modules).map((m) => m.model)),
  ]) {
    const delegate = p[model as keyof PrismaClient] as unknown as {
      updateMany: (args: unknown) => Promise<unknown>;
    };
    await delegate.updateMany({
      where: { slug: { startsWith: "qa-" }, deletedAt: null },
      data: { deletedAt: new Date(), status: "archived" },
    });
  }
  console.log("Synthetic QA records moved to trash.");
}
main().finally(() => p.$disconnect());
