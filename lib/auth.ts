import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { hash, verify } from "@node-rs/argon2";
import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { sendPasswordReset } from "./mail";
const loginKey = (email: unknown) =>
  "account-login:" +
  createHash("sha256")
    .update(typeof email === "string" ? email.toLowerCase() : "")
    .digest("hex");
export const auth = betterAuth({
  appName: "Royal Studio CMS",
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "mysql", transaction: true }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    password: {
      hash: (password) =>
        hash(password, {
          algorithm: 2,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
      verify: ({ hash: encoded, password }) => verify(encoded, password),
    },
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendPasswordReset(user.email, url);
      } catch {
        await prisma.activityLog
          .create({
            data: {
              action: "recovery-delivery-failed",
              entity: "security",
              description:
                "Password recovery delivery is unavailable. Check SMTP configuration.",
            },
          })
          .catch(() => {});
      }
    },
    resetPasswordTokenExpiresIn: 1800,
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 30,
    cookieCache: { enabled: false },
  },
  verification: { storeIdentifier: "hashed" },
  advanced: {
    useSecureCookies:
      process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (
        context.path.startsWith("/passkey/") &&
        ![
          "/passkey/generate-authenticate-options",
          "/passkey/verify-authentication",
        ].includes(context.path)
      ) {
        const session = await auth.api.getSession({
          headers: context.headers || new Headers(),
        });
        const owner = session
          ? await prisma.user.findUnique({
              where: { id: session.user.id },
              include: {
                roles: {
                  include: {
                    role: {
                      include: {
                        permissions: { include: { permission: true } },
                      },
                    },
                  },
                },
              },
            })
          : null;
        if (
          !owner ||
          owner.disabled ||
          !owner.roles.some((r) =>
            r.role.permissions.some(
              (p) => p.permission.key === "security:read",
            ),
          )
        )
          throw new APIError("FORBIDDEN", {
            message:
              "Sign in with an active administrator account to manage passkeys.",
          });
      }
      if (context.path !== "/sign-in/email") return;
      const row = await prisma.rateLimit.findUnique({
        where: { key: loginKey(context.body?.email) },
      });
      if (
        row &&
        row.count >= 5 &&
        Date.now() - Number(row.lastRequest) < 900000
      )
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "Unable to sign in. Please try again later.",
        });
    }),
    after: createAuthMiddleware(async (context) => {
      if (context.path === "/sign-in/email") {
        const key = loginKey(context.body?.email);
        if (context.context.returned instanceof APIError) {
          const now = BigInt(Date.now());
          const previous = await prisma.rateLimit.findUnique({
            where: { key },
          });
          const failed = await prisma.rateLimit.upsert({
            where: { key },
            create: { key, count: 1, lastRequest: now },
            update: {
              count:
                previous && Date.now() - Number(previous.lastRequest) < 900000
                  ? { increment: 1 }
                  : 1,
              lastRequest: now,
            },
          });
          await prisma.activityLog.create({
            data: {
              action: "login-failed",
              entity: "security",
              description: "An administrator sign-in attempt was unsuccessful",
            },
          });
          if (failed.count === 5) {
            const users = await prisma.user.findMany({
              where: {
                disabled: false,
                roles: {
                  some: {
                    role: {
                      permissions: {
                        some: { permission: { key: "users:read" } },
                      },
                    },
                  },
                },
              },
              include: { preferences: true },
            });
            const recipients = users.filter(
              (u) =>
                (u.preferences?.data as Record<string, boolean> | undefined)
                  ?.security !== false,
            );
            await prisma.notification.create({
              data: {
                type: "security",
                title: "Repeated sign-in attempts blocked",
                description:
                  "An account has been temporarily rate limited after repeated unsuccessful sign-ins.",
                href: "/admin/logs",
                receipts: { create: recipients.map((u) => ({ userId: u.id })) },
              },
            });
          }
        } else if (context.context.newSession) {
          await prisma.rateLimit.deleteMany({ where: { key } });
          await prisma.activityLog.create({
            data: {
              userId: context.context.newSession.user.id,
              action: "login",
              entity: "sessions",
              description: "Administrator signed in",
            },
          });
        }
      }
      if (context.path === "/sign-out")
        await prisma.activityLog.create({
          data: {
            action: "logout",
            entity: "sessions",
            description: "An administrator signed out",
          },
        });
    }),
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 900, max: 20 },
      "/passkey/verify-authentication": { window: 60, max: 10 },
      "/passkey/generate-authenticate-options": { window: 60, max: 20 },
      "/passkey/verify-registration": { window: 60, max: 5 },
      "/request-password-reset": { window: 900, max: 3 },
    },
  },
  plugins: [
    twoFactor({ issuer: "Royal Studio CMS" }),
    passkey({
      rpName: "Royal Studio CMS",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      registration: { requireSession: true },
    }),
  ],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
          });
          if (!user || user.disabled) return false;
          return { data: session };
        },
      },
    },
  },
});
