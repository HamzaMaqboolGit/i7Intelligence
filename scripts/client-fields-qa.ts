import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { validateRecord } = await import("../lib/cms/store");
  const { publicClient } = await import("../lib/client-public");
  const base = {
    title: "Client QA Name",
    slug: "client-qa-validation",
    status: "draft",
    sortOrder: 0,
    description: "PRIVATE NOTE TOKEN",
    data: {
      email: "Client@Example.com",
      phone: "+92 300 1234567",
      company: "QA Organization",
      jobTitle: "Director",
      website: "https://example.com",
      profileImage: "/media/private-profile.webp",
      image: "/art/company-logo.svg",
      address: "PRIVATE ADDRESS TOKEN",
      city: "Karachi",
      region: "Sindh",
      postalCode: "74000",
      country: "PK",
      permission: false,
    },
  };
  const valid = validateRecord("clients", base);
  assert.equal(
    (valid.data as Record<string, unknown>).email,
    "client@example.com",
  );
  assert.equal((valid.data as Record<string, unknown>).contactName, base.title);
  for (const data of [
    { ...base.data, email: "" },
    { ...base.data, email: "invalid" },
    { ...base.data, phone: "bad phone" },
    { ...base.data, website: "javascript:alert(1)" },
    { ...base.data, website: "mailto:example@example.com" },
    { ...base.data, country: "ZZ" },
    { ...base.data, company: "", permission: true },
  ])
    assert.throws(() => validateRecord("clients", { ...base, data }));
  const record = {
    ...base,
    id: "qa-only",
    createdAt: "2026-11-24T00:00:00Z",
    updatedAt: "2026-11-24T00:00:00Z",
    deletedAt: null,
  };
  assert.equal(publicClient(record), null);
  assert.equal(publicClient({ ...record, status: "published" }), null);
  const output = publicClient({
    ...record,
    status: "published",
    data: { ...record.data, permission: true },
  })!;
  assert.equal(output.title, "QA Organization");
  assert.equal(output.description, null);
  assert.deepEqual(Object.keys(output.data).sort(), ["image", "permission"]);
  const serialized = JSON.stringify(output);
  for (const secret of [
    base.data.email,
    base.data.phone,
    base.data.profileImage,
    base.data.address,
    base.description,
  ])
    assert.equal(serialized.includes(secret), false);
  assert.equal(
    publicClient({
      ...record,
      status: "archived",
      data: { ...record.data, permission: true },
    }),
    null,
  );
  console.log(
    "PASS: Client fields validate; required email/name, phone, safe website, real country and public-company consent checked. Private contact/photo/notes never enter public client data. No database records or accounts changed.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
