import { PrismaClient } from '@prisma/client';

const target = process.env.SQL_SERVER_DATABASE ?? 'ImportMS';
const url = process.env.DATABASE_URL ?? '';

if (!url) {
  throw new Error('DATABASE_URL is not set');
}

const masterUrl = url.replace(/database=[^;]+/i, 'database=master');

const prisma = new PrismaClient({ datasources: { db: { url: masterUrl } } });

async function main(): Promise<void> {
  const existing = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sys.databases WHERE name = '${target}'`,
  );

  if (existing.length > 0) {
    console.log(`Database ${target} already exists`);
    return;
  }

  await prisma.$executeRawUnsafe(`CREATE DATABASE [${target}]`);
  console.log(`Database ${target} created`);
}

main()
  .catch((error: unknown) => {
    console.log('Could not create the database');
    console.log(String((error as Error)?.message ?? error).slice(0, 1500));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
