import { PrismaClient } from "@prisma/client";
const globalPrisma = globalThis as unknown as { agencyPrisma?: PrismaClient };
export const prisma = globalPrisma.agencyPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalPrisma.agencyPrisma = prisma;
