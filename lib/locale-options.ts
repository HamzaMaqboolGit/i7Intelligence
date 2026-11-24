export const languages = [
  ["en", "English"],
  ["en-GB", "English (United Kingdom)"],
  ["ur", "Urdu"],
  ["ar", "Arabic"],
  ["fr", "French"],
  ["de", "German"],
  ["es", "Spanish"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["tr", "Turkish"],
  ["hi", "Hindi"],
  ["bn", "Bengali"],
  ["zh", "Chinese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["id", "Indonesian"],
  ["ru", "Russian"],
].map(([value, label]) => ({ value, label }));
export const timezones = ["UTC", ...Intl.supportedValuesOf("timeZone")].map(
  (value) => ({ value, label: value.replaceAll("_", " ") }),
);
export const dateFormats = [
  { value: "MMM d, yyyy", label: "Nov 24, 2026" },
  { value: "dd/MM/yyyy", label: "24/11/2026 (day/month/year)" },
  { value: "MM/dd/yyyy", label: "11/24/2026 (month/day/year)" },
  { value: "yyyy-MM-dd", label: "2026-11-24 (ISO)" },
].map((option) => option);
export const timeFormats = [
  { value: "12", label: "12-hour (10:30 PM)" },
  { value: "24", label: "24-hour (22:30)" },
];
