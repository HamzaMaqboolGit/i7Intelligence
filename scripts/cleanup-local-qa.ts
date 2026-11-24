import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { prisma } = await import("../lib/prisma");
  const { delegate } = await import("../lib/cms/store");
  const { modules } = await import("../lib/cms/registry");
  for (const key of Object.keys(modules)) {
    await delegate(key).updateMany({
      where: {
        description: "Synthetic test content; not a real business record.",
        deletedAt: null,
      },
      data: { deletedAt: new Date(), status: "archived" },
    });
  }
  await prisma.emailOutbox.updateMany({
    where: {
      recipient: { endsWith: ".test" },
      status: { in: ["pending", "failed"] },
    },
    data: {
      status: "cancelled",
      lastError:
        "Local synthetic test fixture; do not send to external providers.",
    },
  });
  console.log(
    "Archived only explicitly labeled synthetic QA fixtures; cancelled undeliverable .test outbox jobs.",
  );
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
