import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { prisma } = await import("../lib/prisma");
  const { sendOutbox } = await import("../lib/email");
  const rows = await prisma.emailOutbox.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  let accepted = 0;
  for (const row of rows) {
    try {
      await sendOutbox(row.id);
      accepted++;
    } catch (error) {
      console.error(`Email ${row.id}: ${(error as Error).message}`);
    }
  }
  console.log(
    `${accepted} of ${rows.length} queued messages accepted by SMTP. Final delivery not confirmed.`,
  );
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
