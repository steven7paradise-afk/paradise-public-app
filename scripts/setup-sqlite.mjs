import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.sqlite";

if (!databaseUrl.startsWith("file:")) {
  console.log("Non-SQLite database detected. Prisma db push will handle schema setup.");
  process.exit(0);
}

if (databaseUrl.startsWith("file:")) {
  const rawPath = databaseUrl.slice("file:".length);
  if (rawPath.startsWith("/")) {
    await mkdir(dirname(rawPath), { recursive: true });
  } else if (rawPath.startsWith("./") || rawPath.startsWith("../")) {
    const absolutePath = fileURLToPath(new URL(rawPath, `file://${process.cwd()}/`));
    await mkdir(dirname(absolutePath), { recursive: true });
  }
}

const prisma = new PrismaClient();

await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" DATETIME
  );
`);

await prisma.$disconnect();

console.log("SQLite setup complete.");
