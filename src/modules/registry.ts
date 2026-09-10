import { AppModule, PermissionAction } from '@/config/permissions';

export type ModuleGroup = 'imports' | 'inventory' | 'payables' | 'finance' | 'administration';

export interface ModuleManifest {
  module: AppModule;
  title: string;
  description: string;
  path: string;
  icon: string;
  group: ModuleGroup;
  requiredAction: PermissionAction;
  showInNavigation: boolean;
}

export const MODULE_GROUP_LABELS: Record<ModuleGroup, string> = {
  imports: 'Imports',
  inventory: 'Inventory',
  payables: 'Payables',
  finance: 'Finance',
  administration: 'Administration',
};

export const MODULE_GROUP_ORDER: ModuleGroup[] = [
  'imports',
  'inventory',
  'payables',
  'finance',
  'administration',
];

/**
 * Every module registers itself here with the permission that unlocks it. The
 * sidebar and the landing redirect read from this one list, so adding a module
 * never means editing navigation in several places.
 */
export const MODULE_REGISTRY: readonly ModuleManifest[] = [
  {
    module: AppModule.DASHBOARD,
    title: 'Dashboard',
    description: 'Import load and cost overview',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    group: 'imports',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.SHIPMENTS,
    title: 'Shipments',
    description: 'Import consignments and their landed cost',
    path: '/shipments',
    icon: 'Ship',
    group: 'imports',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.PRODUCTS,
    title: 'Products',
    description: 'Item catalogue with units and HS codes',
    path: '/products',
    icon: 'Package',
    group: 'imports',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.VENDORS,
    title: 'Suppliers and vendors',
    description: 'Goods suppliers, carriers and service providers',
    path: '/vendors',
    icon: 'Factory',
    group: 'imports',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.PURCHASE_ORDERS,
    title: 'Purchase orders',
    description: 'Committed spend awaiting approval',
    path: '/purchase-orders',
    icon: 'ClipboardList',
    group: 'imports',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.GOODS_RECEIPTS,
    title: 'Goods receipts',
    description: 'Book arrived stock at its landed cost',
    path: '/goods-receipts',
    icon: 'PackageCheck',
    group: 'inventory',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.INVENTORY,
    title: 'Inventory',
    description: 'Stock on hand and its value',
    path: '/inventory',
    icon: 'Warehouse',
    group: 'inventory',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.LANDED_COST,
    title: 'Landed cost',
    description: 'Cost per shipment and per product',
    path: '/landed-cost',
    icon: 'Calculator',
    group: 'inventory',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.VENDOR_INVOICES,
    title: 'Vendor invoices',
    description: 'Supplier, carrier and handling bills',
    path: '/vendor-invoices',
    icon: 'ReceiptText',
    group: 'payables',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.VENDOR_PAYMENTS,
    title: 'Vendor payments',
    description: 'Settlements against vendor bills',
    path: '/vendor-payments',
    icon: 'Banknote',
    group: 'payables',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.CLEARING_AGENTS,
    title: 'Clearing agents',
    description: 'Customs brokers by port',
    path: '/clearing-agents',
    icon: 'Stamp',
    group: 'payables',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.AGENT_INVOICES,
    title: 'Agent invoices',
    description: 'Clearing fees, duty and disbursements',
    path: '/agent-invoices',
    icon: 'FileStack',
    group: 'payables',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.AGENT_PAYMENTS,
    title: 'Agent payments',
    description: 'Settlements against clearing agents',
    path: '/agent-payments',
    icon: 'CreditCard',
    group: 'payables',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.EXPENSES,
    title: 'Expenses',
    description: 'Operating cost by category and shipment',
    path: '/expenses',
    icon: 'Wallet',
    group: 'finance',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.LEDGERS,
    title: 'Ledgers',
    description: 'Party statements with running balance',
    path: '/ledgers',
    icon: 'BookOpen',
    group: 'finance',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.MONEY_CHANGERS,
    title: 'Money changers',
    description: 'Currency conversion counterparties',
    path: '/money-changers',
    icon: 'ArrowLeftRight',
    group: 'finance',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.CURRENCY_RATES,
    title: 'Currency rates',
    description: 'Exchange rates by effective date',
    path: '/currency-rates',
    icon: 'TrendingUp',
    group: 'finance',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.REPORTS,
    title: 'Reports',
    description: 'Cost analysis with CSV export',
    path: '/reports',
    icon: 'BarChart3',
    group: 'finance',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.USERS,
    title: 'Users',
    description: 'Accounts and role assignment',
    path: '/users',
    icon: 'Users',
    group: 'administration',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.ROLES,
    title: 'Roles',
    description: 'Permission matrix per role',
    path: '/roles',
    icon: 'ShieldCheck',
    group: 'administration',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.AUDIT_LOGS,
    title: 'Audit log',
    description: 'Who changed what and when',
    path: '/audit-logs',
    icon: 'History',
    group: 'administration',
    requiredAction: PermissionAction.READ,
    showInNavigation: true,
  },
  {
    module: AppModule.SHIPMENT_DOCUMENTS,
    title: 'Documents',
    description: 'Shipment document library',
    path: '/shipments',
    icon: 'Paperclip',
    group: 'imports',
    requiredAction: PermissionAction.READ,
    showInNavigation: false,
  },
];

export function manifestFor(module: AppModule): ModuleManifest | undefined {
  return MODULE_REGISTRY.find((entry) => entry.module === module);
}
