import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./prisma";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const currentAdmin = cache(async (requestHeaders?: Headers) => {
  const session = await auth.api.getSession({
    headers: requestHeaders || (await headers()),
  });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });
  if (!user || user.disabled) return null;
  const roles = user.roles.map((r) => r.role.name);
  const permissions = [
    ...new Set(
      user.roles.flatMap((r) =>
        r.role.permissions.map((p) => p.permission.key),
      ),
    ),
  ];
  if (!roles.length) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    roles,
    permissions,
    twoFactorEnabled: user.twoFactorEnabled,
    sessionId: session.session.id,
  };
});
export type Admin = NonNullable<Awaited<ReturnType<typeof currentAdmin>>>;
export async function requireAdmin(
  permission: string,
  requestHeaders?: Headers,
) {
  const admin = await currentAdmin(requestHeaders);
  if (!admin)
    throw new HttpError(401, "Your session has expired. Please sign in.");
  if (!admin.permissions.includes(permission))
    throw new HttpError(
      403,
      "You do not have permission to perform this action.",
    );
  return admin;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(
    process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.url,
  ).origin;
  if (!origin || origin !== expected)
    throw new HttpError(403, "Request origin could not be verified.");
}
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new HttpError(413, "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "The request is too large.");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
export async function jsonBody(request: Request, limit = 100000) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Use a JSON request.");
  const bytes = await boundedBody(request, limit);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "The request is not valid JSON.");
  }
}
