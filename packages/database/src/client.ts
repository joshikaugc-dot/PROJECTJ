import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __contextosPrisma?: PrismaClient };

/** Single Prisma client per process (survives Next.js dev hot reloads). */
export const prisma: PrismaClient =
  globalForPrisma.__contextosPrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.__contextosPrisma = prisma;
