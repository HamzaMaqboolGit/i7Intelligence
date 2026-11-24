import { PrismaClient } from "@prisma/client";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  existsSync,
  rmSync,
  chmodSync,
  readdirSync,
  statSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import path from "node:path";
process.loadEnvFile(".env.local");
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).formatToParts(new Date());
const date = Object.fromEntries(parts.map((v) => [v.type, v.value]));
const stamp = `${date.year}${date.month}${date.day}_${date.hour}${date.minute}`;
const root = path.resolve(`exports/hostinger_${stamp}`),
  bundle = path.join(root, "private-bundle"),
  source = path.join(root, "source-staging");
mkdirSync(bundle, { recursive: true, mode: 0o700 });
mkdirSync(source, { recursive: true, mode: 0o700 });
chmodSync(root, 0o700);
const db = new PrismaClient();
const url = new URL(process.env.DATABASE_URL);
const database = decodeURIComponent(url.pathname.slice(1));
const config = path.join(root, ".mysql-export.private.cnf");
const escape = (s) =>
  s.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
writeFileSync(
  config,
  `[client]\nhost="${escape(url.hostname)}"\nport=${url.port || 3306}\nuser="${escape(decodeURIComponent(url.username))}"\npassword="${escape(decodeURIComponent(url.password))}"\n`,
  { mode: 0o600 },
);
const write = (name, value) => {
  const full = path.join(bundle, name);
  mkdirSync(path.dirname(full), { recursive: true, mode: 0o700 });
  writeFileSync(full, value, { mode: 0o600 });
};
const run = (cmd, args, options = {}) => {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
  if (r.status !== 0)
    throw new Error(
      `${path.basename(cmd)} failed: ${String(r.stderr || "")
        .replace(/password[^\n]*/gi, "password [redacted]")
        .slice(0, 500)}`,
    );
  return r.stdout;
};
try {
  const list = await db.$queryRawUnsafe("SHOW TABLES");
  const tables = list.map((r) => String(Object.values(r)[0]));
  const exclude = [
    "sessions",
    "password_reset_tokens",
    "rate_limits",
    "enquiry_limits",
  ];
  const counts = {};
  for (const table of tables) {
    const result = await db.$queryRawUnsafe(
      "SELECT COUNT(*) AS n FROM `" + table + "`",
    );
    counts[table] = Number(result[0].n);
  }
  const dump = "/opt/homebrew/opt/mysql@8.4/bin/mysqldump";
  const common = [
    `--defaults-extra-file=${config}`,
    "--single-transaction",
    "--skip-lock-tables",
    "--no-tablespaces",
    "--set-gtid-purged=OFF",
    "--column-statistics=0",
    "--skip-add-locks",
    "--skip-add-drop-table",
    "--default-character-set=utf8mb4",
    "--hex-blob",
    "--skip-comments",
  ];
  const portable = (s) =>
    s.replaceAll("utf8mb4_0900_ai_ci", "utf8mb4_unicode_ci");
  write(
    "database/01-schema.sql",
    portable(run(dump, [...common, "--no-data", database])),
  );
  write(
    "database/02-data.sql",
    portable(
      run(dump, [
        ...common,
        "--no-create-info",
        database,
        ...tables.filter((t) => !exclude.includes(t)),
      ]),
    ),
  );
  write(
    "database/03-post-import.sql",
    `-- Run only in the new imported Hostinger database.\n-- Avoid replaying old queued emails after migration. Delivery history is retained.\nUPDATE email_outbox SET status='cancelled', lastError='Migration: pending delivery paused for operator review' WHERE status IN ('pending','processing');\n`,
  );
  const owners = await db.user.findMany({
    where: { roles: { some: { role: { name: "Super Admin" } } } },
    select: { email: true, name: true, twoFactorEnabled: true, disabled: true },
  });
  const owner = owners.find((v) => !v.disabled);
  if (!owner) throw new Error("No active owner account exists in the export.");
  const temporaryPassword = randomBytes(24).toString("base64url");
  write(
    "private/admin-setup.env",
    `# Optional: activate ONLY on the imported Hostinger database with the documented CLI command.\nDEPLOYMENT_ADMIN_EMAIL=${JSON.stringify(owner.email)}\nDEPLOYMENT_ADMIN_PASSWORD=${JSON.stringify(temporaryPassword)}\n`,
  );
  write("private/local-environment-backup.env", readFileSync(".env.local"));
  const encryption =
    process.env.SMTP_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET;
  write(
    "private/hostinger-production.env",
    `# PRIVATE. Enter these in hPanel Environment Variables, not in public_html.\n# Domain intentionally left unset as requested. Replace every REPLACE_ value.\nNODE_ENV=production\nSTORE_CHECKOUT_ENABLED=false\n# Configure Stripe keys and the signed webhook before enabling checkout.\nDATABASE_URL="mysql://REPLACE_DB_USER:REPLACE_URL_ENCODED_DB_PASSWORD@REPLACE_DB_HOST:3306/REPLACE_DB_NAME"\nDATABASE_ADMIN_URL="mysql://REPLACE_DB_USER:REPLACE_URL_ENCODED_DB_PASSWORD@REPLACE_DB_HOST:3306/REPLACE_DB_NAME"\nBETTER_AUTH_URL="https://REPLACE_YOUR_DOMAIN"\nNEXT_PUBLIC_SITE_URL="https://REPLACE_YOUR_DOMAIN"\nBETTER_AUTH_SECRET=${JSON.stringify(process.env.BETTER_AUTH_SECRET)}\nSMTP_ENCRYPTION_KEY=${JSON.stringify(encryption)}\nMEDIA_DIRECTORY="/home/REPLACE_USERNAME/domains/REPLACE_YOUR_DOMAIN/private/storage/media"\nSTORE_FILE_DIRECTORY="/home/REPLACE_USERNAME/domains/REPLACE_YOUR_DOMAIN/private/storage/store-private"\nSMTP_ALLOWED_HOSTS=${JSON.stringify(process.env.SMTP_ALLOWED_HOSTS || "")}\n# PORT is supplied by the hosting platform. Do not hard-code it here.\n# Existing encrypted SMTP configuration is in the database. Validate it before enabling the worker.\n`,
  );
  write(
    "private/CREDENTIALS.md",
    `# Private credentials and activation\n\nCurrent imported Super Admin email: ${owner.email}\nCurrent account name: ${owner.name}\nTwo-factor enabled: ${owner.twoFactorEnabled ? "yes — use your existing authenticator/recovery codes" : "no"}\n\nThe existing password remains exactly the password you set. It is stored as a one-way hash, so it cannot be recovered or printed. No local account password was changed while preparing this package.\n\nIf you want a known temporary password on the IMPORTED database, admin-setup.env contains the generated password and exact account email. Activate it only after setting Hostinger DATABASE_URL, by running from the deployed app directory:\n\nnode --env-file=/ABSOLUTE_PRIVATE_PATH/hostinger-production.env --env-file=/ABSOLUTE_PRIVATE_PATH/admin-setup.env scripts/set-deployment-password.mjs --confirm-imported-database\n\nThis explicit command replaces the imported account password and revokes imported sessions; it does not disable MFA. It was NOT executed locally. After login, change to your permanent password. Remove the temporary setup file from the server.\n\nHostinger/hPanel login, new database username/password, SMTP-provider login and your domain are not available to this project and are not fabricated. Create the database in hPanel and replace the marked environment fields. URL-encode the database password inside DATABASE_URL.\n\nhostinger-production.env contains the stable application/encryption secrets needed to read imported private configuration. local-environment-backup.env is a LOCAL recovery copy only; its 127.0.0.1:3307 credentials are not Hostinger credentials. Never upload either file to a public web directory.\n`,
  );
  for (const name of ["app", "components", "lib", "prisma", "public"])
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
    cpSync("scripts/" + name, path.join(source, "scripts", name));
  for (const name of [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "next-env.d.ts",
    "postcss.config.mjs",
  ])
    cpSync(name, path.join(source, name));
  const pkg = JSON.parse(
    readFileSync(path.join(source, "package.json"), "utf8"),
  );
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
  mkdirSync(path.join(source, "deployment"));
  cpSync(
    "deployment/HOSTINGER-SETUP.md",
    path.join(source, "deployment/HOSTINGER-SETUP.md"),
  );
  cpSync(
    "deployment/ENVIRONMENT.example.txt",
    path.join(source, "deployment/ENVIRONMENT.example.txt"),
  );
  cpSync(
    "deployment/HOSTINGER-SETUP.md",
    path.join(bundle, "HOSTINGER-SETUP.md"),
  );
  if (existsSync("docs/refinements/PERFORMANCE-RESULTS.json"))
    cpSync(
      "docs/refinements/PERFORMANCE-RESULTS.json",
      path.join(bundle, "PERFORMANCE-RESULTS.json"),
    );
  run("/usr/bin/zip", ["-q", "-r", path.join(root, "app-upload.zip"), "."], {
    cwd: source,
  });
  cpSync(
    path.join(root, "app-upload.zip"),
    path.join(bundle, "app-upload.zip"),
  );
  run(
    "/usr/bin/zip",
    ["-q", "-r", path.join(bundle, "storage-backup.zip"), "storage"],
    { cwd: process.cwd() },
  );
  write(
    "database/EXPORT-MANIFEST.json",
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        timezone: "Asia/Karachi",
        sourceDatabase: database,
        tables: counts,
        dataExcluded: exclude,
        notes: [
          "Schema/migration history and existing user password hashes preserved.",
          "Active sessions/reset tokens/rate limits are not transferred.",
          "Run 03-post-import.sql to pause old pending email deliveries.",
          "Use only on a new empty database.",
          "Application source ZIP contains no environment secrets or database exports.",
        ],
      },
      null,
      2,
    ),
  );
  write(
    "START-HERE.txt",
    "Upload ONLY app-upload.zip using Hostinger Node.js Web App deployment.\nKeep this complete bundle private. Do NOT upload this complete bundle into public_html.\nDatabase SQL is for phpMyAdmin import; storage-backup.zip must restore outside the public directory.\nRead HOSTINGER-SETUP.md and private/CREDENTIALS.md before deployment.\nDomain intentionally not selected.\n",
  );
  const files = [];
  const walk = (dir, prefix = "") => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry),
        rel = path.join(prefix, entry);
      if (statSync(full).isDirectory()) walk(full, rel);
      else
        files.push({
          path: rel,
          size: statSync(full).size,
          sha256: createHash("sha256").update(readFileSync(full)).digest("hex"),
        });
    }
  };
  walk(bundle);
  write("SHA256-MANIFEST.json", JSON.stringify(files, null, 2));
  run(
    "/usr/bin/zip",
    [
      "-q",
      "-r",
      path.join(root, `hostinger-complete-private_${stamp}.zip`),
      ".",
    ],
    { cwd: bundle },
  );
  for (const file of [
    "app-upload.zip",
    `hostinger-complete-private_${stamp}.zip`,
  ])
    chmodSync(path.join(root, file), 0o600);
  console.log("Prepared upload ZIP and complete private bundle in:", root);
  console.log("Database tables exported:", tables.length);
  console.log(
    "Source upload archive bytes:",
    statSync(path.join(root, "app-upload.zip")).size,
  );
} finally {
  rmSync(config, { force: true });
  await db.$disconnect();
}
