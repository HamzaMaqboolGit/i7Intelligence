import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import ClientFields from "../components/admin/client-fields";
const html = renderToStaticMarkup(
  <ClientFields
    record={{ title: "", description: "", data: {} }}
    onChange={() => {}}
  />,
);
for (const text of [
  "Client full name",
  "Email address",
  "Phone number",
  "Company / organization",
  "Job title / role",
  "Company website",
  "Profile image",
  "Street address",
  "City",
  "State / province",
  "Postal code",
  "Country",
  "Private notes",
  "Company logo",
])
  assert.ok(html.includes(text), `Missing ${text}`);
for (const text of [
  "URL slug",
  "Display order",
  "Short description",
  "Legacy contact name",
])
  assert.equal(html.includes(text), false, `Unexpected ${text}`);
assert.match(html, /type="email"[^>]*required/);
assert.match(html, /type="tel"/);
assert.match(html, /type="url"/);
console.log(
  "PASS: Client form renders all contact/address/profile fields, required email and client name, and no unrelated content-editor fields.",
);
