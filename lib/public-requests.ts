import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { HttpError } from "./access";
export async function throttle(tx: Prisma.TransactionClient, identity: string) {
  const key = createHash("sha256").update(identity.toLowerCase()).digest("hex");
  await tx.$executeRaw`INSERT IGNORE INTO enquiry_limits (identity_hash,window_start,attempts) VALUES (${key},NOW(),0)`;
  const rows = await tx.$queryRaw<
    Array<{ attempts: number; expired: number }>
  >`SELECT attempts,window_start < NOW() - INTERVAL 15 MINUTE AS expired FROM enquiry_limits WHERE identity_hash=${key} FOR UPDATE`;
  if (!rows[0].expired && rows[0].attempts >= 5)
    throw new HttpError(
      429,
      "Please wait 15 minutes before submitting another request.",
    );
  await tx.$executeRaw`UPDATE enquiry_limits SET attempts=IF(window_start < NOW() - INTERVAL 15 MINUTE,1,attempts+1),window_start=IF(window_start < NOW() - INTERVAL 15 MINUTE,NOW(),window_start) WHERE identity_hash=${key}`;
}
