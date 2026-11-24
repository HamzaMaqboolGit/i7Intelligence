import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  chmodSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
const previous = path.resolve(
  process.argv[2] || "exports/hostinger_20261124_0039",
);
const parts = Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date())
    .map((p) => [p.type, p.value]),
);
const stamp = `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}`;
const root = path.resolve(`exports/hostinger_${stamp}`),
  source = path.join(root, "source-staging"),
  bundle = path.join(root, "private-bundle");
mkdirSync(root, { mode: 0o700 });
mkdirSync(source, { mode: 0o700 });
cpSync(path.join(previous, "private-bundle"), bundle, { recursive: true });
for (const name of [
  "app",
  "components",
  "lib",
  "prisma",
  "public",
  "deployment",
])
  cpSync(name, path.join(source, name), {
    recursive: true,
    filter: (f) => !f.includes(".DS_Store"),
  });
mkdirSync(path.join(source, "scripts"));
for (const name of [
  "prisma.mjs",
  "seed.ts",
  "bootstrap-admin.ts",
  "upgrade-permissions.ts",
  "email-worker.ts",
  "start-hostinger.mjs",
  "deployment-doctor.mjs",
  "set-deployment-password.mjs",
])
  cpSync(`scripts/${name}`, path.join(source, "scripts", name));
for (const name of [
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "next-env.d.ts",
  "postcss.config.mjs",
])
  cpSync(name, path.join(source, name));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.scripts = {
  dev: pkg.scripts.dev,
  build: pkg.scripts["build:hostinger"],
  start: pkg.scripts["start:hostinger"],
  "db:migrate": pkg.scripts["db:migrate"],
  "db:seed": pkg.scripts["db:seed"],
  "admin:bootstrap": pkg.scripts["admin:bootstrap"],
  "db:permissions": pkg.scripts["db:permissions"],
  "email:worker": pkg.scripts["email:worker"],
  "deployment:check": pkg.scripts["deployment:check"],
  postinstall: "prisma generate",
};
writeFileSync(
  path.join(source, "package.json"),
  JSON.stringify(pkg, null, 2) + "\n",
);
const zip = (out, cwd) => {
  const r = spawnSync("/usr/bin/zip", ["-q", "-r", out, "."], {
    cwd,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error("ZIP creation failed");
};
zip(path.join(root, "app-upload.zip"), source);
cpSync(path.join(root, "app-upload.zip"), path.join(bundle, "app-upload.zip"));
cpSync(
  "deployment/HOSTINGER-SETUP.md",
  path.join(bundle, "HOSTINGER-SETUP.md"),
);
const envPath = path.join(bundle, "private/hostinger-production.env");
let env = readFileSync(envPath, "utf8");
if (!env.includes("STORE_CHECKOUT_ENABLED="))
  env = env.replace(
    "NODE_ENV=production",
    "NODE_ENV=production\nSTORE_CHECKOUT_ENABLED=false",
  );
writeFileSync(envPath, env, { mode: 0o600 });
writeFileSync(
  path.join(bundle, "RELEASE-NOTES.md"),
  `# Updated release\n\nCode built: ${new Date().toISOString()}.\nDatabase and media snapshot reused unchanged from ${path.basename(previous)} (24 November 2026, 00:39 Asia/Karachi). The previous temporary local database is unavailable; this is not a fresh database export.\n\nIncludes settings dropdowns, locale-aware date stamps, animated store menu/dropdowns, HTML email source/layout/preview, Stripe-hosted Checkout and signed fulfillment, owned-order congratulations and billing details.\n\nPayments stay disabled by default. Configure Stripe keys/webhook/server flag and verify sandbox payments before live use. Tax modes other than none block checkout. No real payment was executed. No new schema migration is required.\n\nFor an existing deployment, update application source only and retain its current database, uploaded files and private environment. Import bundled SQL only into a new empty database.\n`,
  { mode: 0o600 },
);
cpSync(
  "docs/refinements/purchase-release/VALIDATION.md",
  path.join(bundle, "VALIDATION.md"),
);
const files = [];
function walk(dir, prefix = "") {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name),
      rel = path.join(prefix, name);
    if (statSync(full).isDirectory()) walk(full, rel);
    else if (rel !== "SHA256-MANIFEST.json")
      files.push({
        path: rel,
        size: statSync(full).size,
        sha256: createHash("sha256").update(readFileSync(full)).digest("hex"),
      });
    chmodSync(full, statSync(full).isDirectory() ? 0o700 : 0o600);
  }
}
walk(bundle);
writeFileSync(
  path.join(bundle, "SHA256-MANIFEST.json"),
  JSON.stringify(files, null, 2),
  { mode: 0o600 },
);
zip(path.join(root, `hostinger-complete-private_${stamp}.zip`), bundle);
chmodSync(path.join(root, "app-upload.zip"), 0o600);
chmodSync(path.join(root, `hostinger-complete-private_${stamp}.zip`), 0o600);
console.log(root);
