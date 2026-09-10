import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tables = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'",
  );

  const [users, roles, permissions, currencies, vendorTypes, categories, services] =
    await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.currency.count(),
      prisma.vendorType.count(),
      prisma.expenseCategory.count(),
      prisma.serviceCharge.count(),
    ]);

  console.log('Tables created :', Number(tables[0]?.total ?? 0));
  console.log('Users          :', users);
  console.log('Roles          :', roles);
  console.log('Permissions    :', permissions);
  console.log('Currencies     :', currencies);
  console.log('Vendor types   :', vendorTypes);
  console.log('Expense cats   :', categories);
  console.log('Service charges:', services);
}

main()
  .catch((error: unknown) => {
    console.log('Verification failed');
    console.log(String((error as Error)?.message ?? error).slice(0, 1000));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
