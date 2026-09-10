import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    'SELECT DB_NAME() AS [database], SUSER_NAME() AS [login], @@SERVERNAME AS [server]',
  );

  console.log('Connection succeeded');
  console.table(rows);
}

main()
  .catch((error: unknown) => {
    console.log('Connection failed');
    console.log(String((error as Error)?.message ?? error).slice(0, 1500));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
