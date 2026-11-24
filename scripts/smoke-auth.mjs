import { readFileSync, writeFileSync } from "node:fs";
const base = "http://127.0.0.1:3001";
const credentials = JSON.parse(readFileSync(".local-admin.json", "utf8"));
const denied = await fetch(base + "/api/admin/portfolio");
console.log("Unauthenticated CMS API", denied.status);
const route = await fetch(base + "/admin", { redirect: "manual" });
console.log(
  "Protected admin route",
  route.status,
  route.headers.get("location"),
);
const response = await fetch(base + "/api/auth/sign-in/email", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({
    email: credentials.email,
    password: credentials.password,
    rememberMe: false,
  }),
});
const body = await response.json();
console.log(
  "Admin login",
  response.status,
  response.ok ? "authenticated" : body,
);
if (!response.ok) process.exit(1);
const cookie = response.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
writeFileSync(".local-test-session", cookie, { mode: 0o600 });
for (const path of [
  "/api/admin/overview",
  "/api/admin/portfolio",
  "/api/admin/pages",
  "/api/admin/settings",
  "/api/admin/users",
  "/api/admin/notifications",
  "/api/admin/security",
]) {
  const r = await fetch(base + path, { headers: { Cookie: cookie } });
  const d = await r.json();
  console.log(path, r.status, r.ok ? "OK" : d);
}
