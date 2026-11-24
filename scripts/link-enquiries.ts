import { PrismaClient } from "@prisma/client";
try {
  process.loadEnvFile(".env.local");
} catch {}
const p = new PrismaClient();
async function main() {
  const old = await p.legacyEnquiry.findMany();
  for (const row of old) {
    if (
      await p.contactMessage.findUnique({ where: { slug: `legacy-${row.id}` } })
    )
      continue;
    const record = await p.contactMessage.findFirst({
      where: {
        AND: [
          { data: { path: "$.email", equals: row.email } },
          { data: { path: "$.message", equals: row.message } },
        ],
      },
    });
    if (record)
      await p.contactMessage.update({
        where: { id: record.id },
        data: { slug: `legacy-${row.id}` },
      });
  }
  await p.bookingRequest.updateMany({
    where: { data: { path: "$.name", equals: "QA public booking" } },
    data: { deletedAt: new Date(), status: "archived" },
  });
  await p.newsletterSubscriber.updateMany({
    where: { data: { path: "$.email", string_contains: "qa-business-" } },
    data: { deletedAt: new Date(), status: "archived" },
  });
  console.log(
    "Legacy enquiry links aligned without duplicating records; earlier synthetic business fixture hidden.",
  );
}
main().finally(() => p.$disconnect());
