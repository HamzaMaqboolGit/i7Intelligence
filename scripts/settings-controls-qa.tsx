import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldInput } from "../components/admin/fields";
import {
  languages,
  timezones,
  dateFormats,
  timeFormats,
} from "../lib/locale-options";
for (const [key, value] of [
  ["language", "en"],
  ["timezone", "Asia/Karachi"],
  ["dateFormat", "yyyy-MM-dd"],
  ["timeFormat", "24"],
]) {
  const html = renderToStaticMarkup(
    <FieldInput
      field={{ key, label: key }}
      value={value}
      onChange={() => {}}
    />,
  );
  assert.ok(html.includes('role="combobox"'), `${key} must be a dropdown`);
  assert.ok(
    !html.includes('type="text"'),
    `${key} must not be a free-text field`,
  );
}
assert.ok(timezones.some((x) => x.value === "Asia/Karachi"));
assert.ok(timezones.length > 300);
assert.ok(languages.length >= 15);
assert.equal(dateFormats.length, 4);
assert.equal(timeFormats.length, 2);
console.log(
  "PASS: settings use labelled dropdowns, including IANA timezones, date format and 12/24-hour choices.",
);
