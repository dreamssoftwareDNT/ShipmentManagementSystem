import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  PERMISSION_CATALOGUE,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_MATRIX,
} from '../src/config/permissions';
import { RoleCode } from '../src/types/enums';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Freight@2026!';

interface SeedUser {
  fullName: string;
  email: string;
  employeeCode: string;
  role: RoleCode;
}

const USERS: SeedUser[] = [
  { fullName: 'Amina Farooq', email: 'admin@importms.local', employeeCode: 'EMP-0001', role: RoleCode.ADMIN },
  { fullName: 'Daniel Okoye', email: 'operations@importms.local', employeeCode: 'EMP-0002', role: RoleCode.OPERATIONS_MANAGER },
  { fullName: 'Priya Raman', email: 'finance@importms.local', employeeCode: 'EMP-0003', role: RoleCode.FINANCE_MANAGER },
  { fullName: 'Tomas Nowak', email: 'accounts@importms.local', employeeCode: 'EMP-0004', role: RoleCode.ACCOUNTANT },
  { fullName: 'Leila Haddad', email: 'shipments@importms.local', employeeCode: 'EMP-0005', role: RoleCode.SHIPMENT_MANAGER },
  { fullName: 'Marco Bianchi', email: 'vendors@importms.local', employeeCode: 'EMP-0006', role: RoleCode.VENDOR_MANAGER },
  { fullName: 'Sara Lindqvist', email: 'viewer@importms.local', employeeCode: 'EMP-0007', role: RoleCode.VIEWER },
];

const CURRENCIES = [
  { code: 'USD', name: 'United States Dollar', symbol: '$', isBase: true },
  { code: 'EUR', name: 'Euro', symbol: '€', isBase: false },
  { code: 'GBP', name: 'Pound Sterling', symbol: '£', isBase: false },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', isBase: false },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs', isBase: false },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', isBase: false },
];

const VENDOR_TYPES = [
  { code: 'SHIPPING_LINE', name: 'Shipping line', description: 'Ocean carriers operating vessel services' },
  { code: 'AIRLINE', name: 'Airline', description: 'Air cargo carriers' },
  { code: 'TRANSPORT', name: 'Transport company', description: 'Road and rail haulage providers' },
  { code: 'WAREHOUSE', name: 'Warehouse', description: 'Storage, handling and consolidation' },
  { code: 'INSURANCE', name: 'Insurance company', description: 'Cargo insurance underwriters' },
  { code: 'OTHER', name: 'Other', description: 'Any other service provider' },
];

const EXPENSE_CATEGORIES = [
  { code: 'PORT_CHARGES', name: 'Port and terminal charges' },
  { code: 'HAULAGE', name: 'Inland haulage' },
  { code: 'DEMURRAGE', name: 'Demurrage and detention' },
  { code: 'DOCUMENTATION', name: 'Documentation and courier' },
  { code: 'OFFICE', name: 'Office and administration' },
  { code: 'TRAVEL', name: 'Travel and subsistence' },
  { code: 'BANK_CHARGES', name: 'Bank charges' },
];

const SERVICE_CHARGES = [
  { code: 'OCEAN_FREIGHT', name: 'Ocean freight', defaultRate: 1450, taxRate: 0 },
  { code: 'AIR_FREIGHT', name: 'Air freight', defaultRate: 3.8, taxRate: 0 },
  { code: 'THC_ORIGIN', name: 'Terminal handling at origin', defaultRate: 185, taxRate: 0 },
  { code: 'THC_DEST', name: 'Terminal handling at destination', defaultRate: 210, taxRate: 0 },
  { code: 'DOC_FEE', name: 'Documentation fee', defaultRate: 65, taxRate: 15 },
  { code: 'CUSTOMS_CLEARANCE', name: 'Customs clearance', defaultRate: 240, taxRate: 15 },
  { code: 'DELIVERY', name: 'Delivery to door', defaultRate: 420, taxRate: 15 },
  { code: 'INSURANCE', name: 'Cargo insurance', defaultRate: 95, taxRate: 0 },
];

async function seedPermissionsAndRoles(): Promise<Map<RoleCode, string>> {
  for (const permission of PERMISSION_CATALOGUE) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        module: permission.module,
        action: permission.action,
        description: permission.description,
      },
      update: { module: permission.module, action: permission.action },
    });
  }

  const permissionIds = new Map(
    (await prisma.permission.findMany({ select: { id: true, code: true } })).map((permission) => [
      permission.code,
      permission.id,
    ]),
  );

  const roleIds = new Map<RoleCode, string>();

  for (const [code, definition] of Object.entries(ROLE_DEFINITIONS)) {
    const roleCode = code as RoleCode;

    const role = await prisma.role.upsert({
      where: { code: roleCode },
      create: {
        code: roleCode,
        name: definition.name,
        description: definition.description,
        isSystem: true,
      },
      update: { name: definition.name, description: definition.description },
    });

    roleIds.set(roleCode, role.id);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    const codes = ROLE_PERMISSION_MATRIX[roleCode];
    const uniqueCodes = [...new Set(codes)];

    await prisma.rolePermission.createMany({
      data: uniqueCodes
        .map((permissionCode) => permissionIds.get(permissionCode))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId })),
    });
  }

  return roleIds;
}

async function seedUsers(roleIds: Map<RoleCode, string>): Promise<string> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  let administratorId = '';

  for (const seedUser of USERS) {
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      create: {
        fullName: seedUser.fullName,
        email: seedUser.email,
        employeeCode: seedUser.employeeCode,
        passwordHash,
        status: 'ACTIVE',
        isSystemAccount: seedUser.role === RoleCode.ADMIN,
        passwordChangedAt: new Date(),
      },
      update: { fullName: seedUser.fullName, status: 'ACTIVE' },
    });

    if (seedUser.role === RoleCode.ADMIN) {
      administratorId = user.id;
    }

    const roleId = roleIds.get(seedUser.role);

    if (roleId) {
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.create({ data: { userId: user.id, roleId } });
    }
  }

  return administratorId;
}

async function seedReferenceData(actorId: string): Promise<void> {
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      create: { ...currency, createdById: actorId, updatedById: actorId },
      update: { name: currency.name, isBase: currency.isBase },
    });
  }

  for (const vendorType of VENDOR_TYPES) {
    await prisma.vendorType.upsert({
      where: { code: vendorType.code },
      create: { ...vendorType, createdById: actorId, updatedById: actorId },
      update: { name: vendorType.name, description: vendorType.description },
    });
  }

  for (const category of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { code: category.code },
      create: { ...category, createdById: actorId, updatedById: actorId },
      update: { name: category.name },
    });
  }

  for (const charge of SERVICE_CHARGES) {
    await prisma.serviceCharge.upsert({
      where: { code: charge.code },
      create: {
        code: charge.code,
        name: charge.name,
        defaultRate: new Prisma.Decimal(charge.defaultRate),
        taxRate: new Prisma.Decimal(charge.taxRate),
        createdById: actorId,
        updatedById: actorId,
      },
      update: { name: charge.name },
    });
  }

  const usd = await prisma.currency.findUniqueOrThrow({ where: { code: 'USD' } });
  const pkr = await prisma.currency.findUniqueOrThrow({ where: { code: 'PKR' } });
  const eur = await prisma.currency.findUniqueOrThrow({ where: { code: 'EUR' } });
  const effectiveFrom = new Date(new Date().getFullYear(), 0, 1);

  const rates: Array<[string, string, number]> = [
    [usd.id, pkr.id, 279.5],
    [usd.id, eur.id, 0.92],
    [eur.id, usd.id, 1.087],
  ];

  for (const [fromCurrencyId, toCurrencyId, rate] of rates) {
    const existing = await prisma.currencyRate.findFirst({
      where: { fromCurrencyId, toCurrencyId, effectiveFrom },
    });

    if (!existing) {
      await prisma.currencyRate.create({
        data: {
          fromCurrencyId,
          toCurrencyId,
          rate: new Prisma.Decimal(rate),
          effectiveFrom,
          source: 'Seed data',
          createdById: actorId,
          updatedById: actorId,
        },
      });
    }
  }

  const company = await prisma.companyProfile.findFirst();

  if (!company) {
    await prisma.companyProfile.create({
      data: {
        legalName: 'Meridian Freight Forwarding Limited',
        tradingName: 'Meridian Freight',
        taxNumber: 'TX-4451209',
        registrationNo: 'REG-88213',
        email: 'operations@meridianfreight.example',
        phone: '+971 4 555 0110',
        addressLine1: 'Unit 14, Logistics Park',
        city: 'Dubai',
        country: 'United Arab Emirates',
        baseCurrency: 'USD',
        invoiceFooter: 'Payment is due within the agreed credit terms. Please quote the invoice number.',
        updatedById: actorId,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log('Seeding access control');
  const roleIds = await seedPermissionsAndRoles();

  console.log('Seeding users');
  const administratorId = await seedUsers(roleIds);

  console.log('Seeding reference data');
  await seedReferenceData(administratorId);

  console.log('\nSeed complete.');
  console.log(`Sign in with ${USERS[0]?.email} and password ${DEMO_PASSWORD}`);
  console.log('Every seeded account shares that password. Change them before any real use.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
