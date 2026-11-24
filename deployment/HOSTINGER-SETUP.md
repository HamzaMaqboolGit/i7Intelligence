# Hostinger deployment — Advanced Telecom / Agency CMS

This package contains the actual Next.js application, current database snapshot, private uploads and setup information. No domain has been selected and nothing has been deployed to Hostinger.

## What to upload

- **app-upload.zip**: the only ZIP to upload to Hostinger's **Node.js Web App** deployment screen. package.json is at the archive root.
- **database/01-schema.sql**, **02-data.sql**, **03-post-import.sql**: import privately into a new empty MySQL/MariaDB database, in that order.
- **storage-backup.zip**: restore to a private, persistent storage directory; its archive root contains `storage/media` and `storage/store-private`.
- **private/**: credential and environment files for your own use. Keep the complete bundle private. Do not upload it into `public_html`, commit it, or serve it through the website.
- **SHA256-MANIFEST.json**: checksums of all files in the complete bundle.

A PHP-only/shared static-file upload cannot run this application. It needs a Hostinger plan with Node.js Web Apps support (Business/Unlimited or Cloud), or a VPS running Node.js and MySQL. Hostinger's official instructions: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

## 1. Create the database

In hPanel, create a NEW database and database user. Record the full prefixed database name, username, password and the internal host supplied for this application. These credentials are generated/selected in your Hostinger account; they are not the local development database credentials.

Use Hostinger's internal database hostname as instructed by hPanel. Do not copy the local `127.0.0.1:3307` URL, use an external `srv*.hstgr.io` hostname in the hosted app, or invent a database name/user. Standard MySQL port is 3306 unless hPanel says otherwise.

In phpMyAdmin, select the new empty database and import:

1. database/01-schema.sql
2. database/02-data.sql
3. database/03-post-import.sql

Do not import the snapshot into a database with existing tables. It does not drop existing tables; use a separate empty database. SQL includes the existing Prisma migration history, so do not run `db:seed` after importing this snapshot. The seed command is for a fresh reference/demo installation and is not needed for your current content.

The export preserves content, account password hashes, MFA state, products, inquiries, orders and configuration. Active sessions, password-reset/challenge tokens, and throttling data are omitted. Post-import SQL cancels old pending/processing email jobs so migration cannot replay old deliveries. Historical sent/failed/unknown delivery records remain available for review. Existing demo/QA content is preserved rather than silently deleted; review it before launch, including the explicitly labeled Karachi demo location.

## 2. Restore media and private paid files

Create a writable private directory OUTSIDE `public_html` and outside any build-output directory, for example the account's private directory under the website. Use the actual absolute path available in YOUR account, not the placeholder literally.

Extract storage-backup.zip there. Its final structure should be:

    /YOUR_PRIVATE_PATH/storage/media/*.webp
    /YOUR_PRIVATE_PATH/storage/store-private/*.zip or *.pdf

Set MEDIA_DIRECTORY and STORE_FILE_DIRECTORY to those exact absolute paths. Run `npm run deployment:check` after configuration to verify access. Both directories must persist across redeployments. If the managed Node.js deployment cannot mount/write persistent private storage, ask Hostinger support for its supported persistent-storage setup or use a VPS; do not place paid files in a public/static directory. Back up the database AND these directories together.

## 3. Prepare environment variables

Use private/hostinger-production.env as your PRIVATE checklist. The application and encryption secrets are real and must remain stable to read imported encrypted settings/MFA data. Do not put them in any NEXT_PUBLIC variable.

Replace every REPLACE_ placeholder:

- DATABASE_URL: `mysql://FULL_USER:URL_ENCODED_PASSWORD@INTERNAL_HOST:3306/FULL_DATABASE`
- DATABASE_ADMIN_URL: migration connection. The same Hostinger DB user may be used if it has DDL permission; otherwise use a migration-only user. Do not expose this to the browser.
- BETTER_AUTH_URL: the exact HTTPS origin of your deployed site.
- NEXT_PUBLIC_SITE_URL: the same exact HTTPS origin, with no trailing path.
- MEDIA_DIRECTORY and STORE_FILE_DIRECTORY: actual persistent private paths.
- SMTP_ALLOWED_HOSTS: exact SMTP provider hostname(s), when configured.

No domain is chosen in this package. You may use the temporary HTTPS address Hostinger assigns, and later update BOTH origin variables when you choose a domain. Rebuild after changing NEXT_PUBLIC_SITE_URL. Passkeys are origin/domain-bound: localhost passkeys cannot become production-domain passkeys; register a new passkey on the deployed HTTPS origin.

URL-encode special characters in the DB password. Example: `@` becomes `%40`; do not paste an unencoded password containing URL delimiters into DATABASE_URL. Prefer hPanel environment variables. On a VPS, store a protected env file outside the document root and load it into the process before startup.

For SSH or cron, hPanel application variables may not be inherited by your shell. Keep a filled-in private environment file outside the web directory and explicitly load it:

    node --env-file=/YOUR_PRIVATE_PATH/hostinger-production.env scripts/deployment-doctor.mjs
    node --env-file=/YOUR_PRIVATE_PATH/hostinger-production.env scripts/prisma.mjs migrate deploy
    node --env-file=/YOUR_PRIVATE_PATH/hostinger-production.env --import tsx scripts/email-worker.ts

Do not run those examples until the private file's placeholders have been replaced. The worker command is for the scheduled worker only; it is not an extra web server.

## 4. Upload and build the Node.js app

In hPanel: Websites → add/create **Node.js Web App** → upload **app-upload.zip**. Do not choose PHP/static deployment.

Build settings:

- Framework: Next.js
- Node.js: **22 LTS** (22.12 or later); Node 24 LTS is also an option if available.
- Package manager: npm
- Root directory: archive root (package.json is directly there)
- Install: `npm ci --include=dev`
- Build: `npm run build`
- Output directory: `.next`, if the form asks
- Start: `npm start`
- PORT: supplied by Hostinger; the startup script uses it and binds to 0.0.0.0.

The packaged npm build script runs Prisma generation and a production Next.js webpack build. This avoids a macOS-generated Prisma binary being reused on Linux and avoids known deployment-environment Turbopack restrictions. Source ZIP excludes node_modules and local build output. Do NOT upload the macOS node_modules directory. The bundled local font files remove build-time Google Fonts network requests.

Set environment variables before the first build. If the install step omits devDependencies and Prisma/TypeScript is missing, use `npm ci --include=dev` and retry the build.

If Hostinger cannot execute Next's start command for a custom entry field, select the Next.js framework preset rather than a generic PHP/static preset. For a VPS, run `npm ci --include=dev`, `npm run build`, then `npm start` under a process manager and configure your HTTPS reverse proxy.

## 5. Database migrations

The exported snapshot already includes all applied migrations through 007_passkeys. After import you can run:

    npm run db:migrate

It should report no pending migrations for this release. Never run `prisma migrate reset`, `db push --force-reset`, or re-import over your live database. Back up before future schema upgrades. The migration command reads DATABASE_ADMIN_URL when provided.

## 6. Sign in

Visit `https://YOUR_ACTUAL_ORIGIN/admin/login`.

Use the exact current Super Admin email listed in private/CREDENTIALS.md and your existing password. That password is a one-way hash in the DB and cannot be recovered into plaintext. Your local password was not changed to prepare this package.

If you need the generated temporary deployment password instead, load private/admin-setup.env into the explicit password-setup command documented in private/CREDENTIALS.md. Run it ONLY against the imported Hostinger database. It replaces that exact imported Super Admin account password, revokes its sessions, and leaves MFA enabled when already configured. Change to your own permanent password afterward. Do not put the temporary credentials in a build script, public URL or startup command.

A completely empty installation (not the imported snapshot) can instead use migrations, seed and `admin:bootstrap` with ADMIN_EMAIL/ADMIN_NAME/ADMIN_PASSWORD environment values. This is an alternative reference install, not the migration path for your current content.

## 7. Email and scheduled worker

SMTP values are configured under Site Settings → Email / SMTP and stored encrypted in the database. The matching encryption key is supplied in the private environment file. Verify the provider and send a deliberate test before enabling delivery.

Schedule `npm run email:worker` once per minute using a Hostinger-supported scheduled command/worker with the same environment and app working directory. If your managed plan cannot schedule a Node.js worker with those environment variables, use a supported persistent worker/VPS. Do not expose an unauthenticated HTTP worker endpoint. The worker sends pending jobs only; provider acceptance is not guaranteed final inbox delivery.

## 8. Verify before publishing

Run `npm run deployment:check` from the deployed app environment. Then check:

- HTTPS homepage shows your saved company name/logo and public theme.
- Admin login, sign-out, permissions and your chosen admin theme work.
- Navigation changes content without a new document load; sidebar state remains in place.
- Uploaded images, private file permissions and location map display correctly.
- A deliberate contact/booking request appears in admin; notification badge is red. Sound requires the first browser interaction and can be muted in the notification menu.
- Password reset and email only work after SMTP and the worker are configured.
- Register fingerprint/passkey only on the final HTTPS origin and a supported device. Biometric verification needs a real device/browser test.
- Remove or replace demo location, dummy/test products, QA inquiries and reference content you do not intend to show.

## Important current commerce status

Stripe-hosted Checkout, signed payment webhooks, owned-order purchase congratulations, billing details, and digital access fulfillment are included. **Checkout remains OFF by default. No real Stripe sandbox or live payment was executed while preparing this package.**

Configure matching Stripe test keys and a webhook signing secret under Store settings → Payments (or STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET server secrets). Prefer a restricted key with the needed Checkout Sessions and Payment Intents permissions. Keep test/live configurations separate. Set `STORE_CHECKOUT_ENABLED=true` only for the intended environment after setup; keep it `false` otherwise. HTTPS is mandatory for live checkout.

Register `https://YOUR_DOMAIN/api/store/webhook` in Stripe with these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`. Use the signing secret from that exact endpoint/environment. A success redirect never marks an order paid. Verify a sandbox payment, delayed payment, duplicate webhook delivery and refund before enabling live payments. The return page polls verified owned-order state; billing and products never come from query-string values.

The current payment integration supports tax mode `none` only. Configured manual/Stripe Tax modes block checkout until a reviewed tax integration is added; do not interpret `none` as a determination that your sales are tax-exempt. No tax registration is inferred or enabled. Full-discount/free carts are not charged; arrange access through support.

Successful signed webhooks grant digital entitlements once, queue a confirmation HTML email, and preserve newer cart edits. Refund/dispute webhooks suspend download access. Starting refunds from this app remains unsupported; process them in Stripe and let the webhook update access. Run the email worker to deliver queued confirmations.

The private package defaults `STORE_CHECKOUT_ENABLED=false`; domain remains unset as requested. No Stripe account, keys, or webhook registration is created by uploading the ZIP.

## Performance behavior in this package

Admin layout is persistent, heavy admin screens load separately, internal links use client navigation, dashboard retries do not reload the document, and the whole-app fade was removed. Public CMS snapshots/settings are cached for 30 seconds and immediately expired on CMS saves; authentication, permissions, cart pricing and payment/download authorization are not cached. Individual content animations remain. Actual speed on Hostinger depends on its CPU, database location, storage and network; local measurements are in PERFORMANCE-RESULTS.json when present.

## Client records

Clients use contact-oriented fields: full name and email (required), phone, company/organization, job role, HTTPS website, private profile image, structured address/country, and private notes. URL slug and display order are internal and are not shown in the client form. Visible Active/Inactive labels retain the existing database status values for compatibility, so no additional schema migration is needed.

Only explicitly approved, active company branding can appear publicly. The company logo is separate from the private profile image, and client contact details/notes are excluded from public site snapshots. Existing company-logo records remain readable; complete the newly required contact details when editing them. CSV export uses client-oriented columns.

## Updates and rollback

Back up database + private storage first. Upload a new app-upload.zip using Redeploy; retain existing environment variables and persistent storage. Apply only new migrations. If rolling back code, confirm its schema compatibility first. Never restore old active sessions or publish the private bundle. Keep a copy of the stable encryption key with your private backups.

## Updated settings and email templates

General settings have language, IANA timezone, date-format and 12/24-hour dropdowns. Date stamps use the saved settings; language selects formatting locale, not automatic translation of all interface copy. Customer booking times remain explicitly local to the customer's browser. Digital Store navigation and shared dropdowns animate opening and closing, with reduced-motion support.

Email / SMTP → Templates includes HTML source, a visual editor for simple content, a branded table-layout wrapper and an isolated preview. Table layouts stay in HTML mode to prevent the simple visual editor from stripping layout. Server sanitization preserves safe email tables/inline typography and removes scripts, event handlers and unsafe links. External images are blocked in preview; delivered emails may contain HTTPS images. Variables remain escaped on delivery. The email subject/address fields remain plain text and email inputs.
