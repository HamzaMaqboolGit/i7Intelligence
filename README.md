# Royal Studio — Agency website and CMS

Existing Next.js 16 / React 19 application, upgraded with a midnight navy design system, cinematic Framer Motion, a MySQL-backed public website and protected agency CMS. No Redis or PostgreSQL. No deployment has been performed.

## Run locally

```sh
npm install
cp .env.example .env.local
# Fill DATABASE_URL, migration credentials, BETTER_AUTH_URL and a random BETTER_AUTH_SECRET.
npm run db:migrate
npm run db:seed
npm run dev
```

The delivered local workspace already has `.env.local`, an isolated MySQL 8.4 database and a CLI-created administrator. Credentials are generated, not hardcoded. Read the private, ignored `.local-admin.json` file for the local login. Do not commit or deploy that file. Change the initial password through Security Settings when taking ownership.

Current preview URL is reported in the delivery message. Prefer `127.0.0.1` on this machine: `localhost` can resolve to another existing IPv6 app. All authorization/origin settings must use the same canonical origin as the URL you open.

## First administrator

Public registration is disabled. After migrations and content import:

```sh
ADMIN_EMAIL='your-email' ADMIN_NAME='Your Name' ADMIN_PASSWORD='a-generated-strong-password' npm run admin:bootstrap
```

Supply credentials through temporary process environment variables in a secure terminal. The bootstrap command refuses to run once any administrator exists. Subsequent administrators are managed through `/admin/users` by a permitted Super Admin. The supplied example placeholders above are not real credentials.

## Database and storage

Existing `enquiries` and `enquiry_limits` tables are baselined and preserved. New contact submissions continue to populate the original enquiry table, with the CMS contact and notification writes in the same transaction. Content imports are idempotent and do not overwrite edited records. Migrations are additive and use Prisma/MySQL.

For the existing local setup, MySQL data is in `/private/tmp/royal-studio-mysql-data`, bound to loopback port 3307. Restart if necessary:

```sh
/opt/homebrew/opt/mysql@8.4/bin/mysqld --no-defaults --datadir=/private/tmp/royal-studio-mysql-data --port=3307 --bind-address=127.0.0.1 --socket=/tmp/royal-studio-mysql.sock --mysqlx=OFF
```

Temporary storage is suitable for local review only. Production requires a durable MySQL service, backups, HTTPS and durable `MEDIA_DIRECTORY` storage. The application user needs SELECT/INSERT/UPDATE/DELETE; migration credentials are separate. `DATABASE_ADMIN_URL` is only used by the explicit migration script. The local `ALLOW_LOCAL_MIGRATION=1` helper is restricted to the project-specific temporary admin credential file; it is not needed for production.

## Configuration

- Palette: `app/tokens.css`.
- Motion timing: `lib/motion.ts`.
- Content types and forms: `lib/cms/registry.ts`.
- Database: `prisma/schema.prisma`, versioned `prisma/migrations/`.
- Public readers: `lib/cms/public.ts` and `lib/cms/store.ts`.
- Authentication and permission checks: `lib/auth.ts`, `lib/access.ts`.
- Admin UI: `components/admin/`.
- General brand, navigation, footer, SEO, booking URL and office coordinates: editable in `/admin`.
- SMTP: configure the environment fields before sending real reset emails. Development-only recovery messages are written privately to ignored `.local-mails/`.

Published, nontrashed records drive the public site. Drafts and future-dated articles remain private. All mutations require server-side permissions and origin validation. Soft deletes preserve history. Optional TOTP and recovery codes are available in Security Settings. Sign-out and session revocation invalidate database sessions.

Maps use Leaflet/OpenStreetMap and are loaded only when the visitor requests them. No marker appears until a real office location is entered. Booking requests are requests pending confirmation, not instant reservations. Visitor analytics remains an explicit empty state until a real integration is connected.

## Verification

```sh
npm run typecheck
npm run lint
npm run build
node scripts/smoke-auth.mjs
npx tsx scripts/verify-cms.ts
npx tsx scripts/security-qa.ts
node scripts/browser-qa.mjs
node scripts/verify-failure.mjs
```

The QA scripts are local integration tests. They require the local server, MySQL and private test credentials; they are not meant to run against production. They create clearly named synthetic records, then soft-delete/disable them. `browser-qa.mjs` requires `npx playwright install chromium`. Test results and captured screenshots are saved in `docs/upgrade/`.

Read [the implementation notes](docs/upgrade/IMPLEMENTATION.md), [reference audit](docs/upgrade/PHASE-1-AUDIT.md) and [verification results](docs/upgrade/QA.md) for exact scope, test evidence and remaining external configuration. Original asset licensing is documented in `docs/ASSETS.md`.

## Current CMS completion and commerce work

The running local preview is **http://127.0.0.1:3000**. Administration: `/admin/settings`; store administration: `/admin/store`; public catalog: `/shop`.

See `docs/completion/PHASE-REPORT.md` for the CMS/email upgrade and verified limitations. See `docs/commerce/STATUS.md` for commerce status. Commerce is **not yet production-ready**: Stripe checkout, webhook fulfillment and refunds remain unimplemented pending the required planning/sandbox configuration. The checkout endpoint fails closed and does not claim payment success.

Safe local migration sequence: `npm run db:migrate`, `npm run db:permissions`. Existing installations with the old hardcoded About dropdown can run `npx tsx scripts/upgrade-navigation.ts` once to preserve those links as database menu children. Never reset the database. Production schema changes need a separate migration credential; the app user should have data access only.

Email: configure `SMTP_ALLOWED_HOSTS` and stable `SMTP_ENCRYPTION_KEY`, save encrypted credentials through Settings → Email, then schedule `npm run email:worker` against the intended environment. Pending jobs are durable; ambiguous SMTP attempts are never resent automatically. SMTP acceptance is not confirmed inbox delivery. Inbound mail synchronization and reply attachments are not configured.

Private store files require durable, non-public `STORE_FILE_DIRECTORY`. ZIP/PDF only, 25 MB/file. Back up that directory together with MySQL. Do not map it into a public web-server route.

Additional checks: `npm run test:completion`, `npm run test:commerce`, `npm run test:commerce-browser`, and `npx tsx scripts/download-qa.ts`. Test scripts use explicitly synthetic local fixtures; do not point them at production. No live Stripe charge, live refund or real customer delivery has been tested.
