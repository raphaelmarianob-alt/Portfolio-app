import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");

function makePrisma() {
  const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
