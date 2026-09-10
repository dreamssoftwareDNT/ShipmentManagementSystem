import { RoleCode } from '@/types/enums';

export const PermissionAction = {
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  EXPORT: 'EXPORT',
} as const;
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction];

export const AppModule = {
  DASHBOARD: 'DASHBOARD',
  PRODUCTS: 'PRODUCTS',
  SHIPMENTS: 'SHIPMENTS',
  SHIPMENT_DOCUMENTS: 'SHIPMENT_DOCUMENTS',
  SHIPMENT_TRACKING: 'SHIPMENT_TRACKING',
  LANDED_COST: 'LANDED_COST',
  GOODS_RECEIPTS: 'GOODS_RECEIPTS',
  INVENTORY: 'INVENTORY',
  VENDORS: 'VENDORS',
  PURCHASE_ORDERS: 'PURCHASE_ORDERS',
  VENDOR_INVOICES: 'VENDOR_INVOICES',
  VENDOR_PAYMENTS: 'VENDOR_PAYMENTS',
  CLEARING_AGENTS: 'CLEARING_AGENTS',
  AGENT_INVOICES: 'AGENT_INVOICES',
  AGENT_PAYMENTS: 'AGENT_PAYMENTS',
  MONEY_CHANGERS: 'MONEY_CHANGERS',
  CURRENCY_RATES: 'CURRENCY_RATES',
  EXPENSES: 'EXPENSES',
  LEDGERS: 'LEDGERS',
  REPORTS: 'REPORTS',
  USERS: 'USERS',
  ROLES: 'ROLES',
  SETTINGS: 'SETTINGS',
  AUDIT_LOGS: 'AUDIT_LOGS',
} as const;
export type AppModule = (typeof AppModule)[keyof typeof AppModule];

export type PermissionCode = `${AppModule}:${PermissionAction}`;

export function permission(module: AppModule, action: PermissionAction): PermissionCode {
  return `${module}:${action}`;
}

const CRUD: PermissionAction[] = [
  PermissionAction.CREATE,
  PermissionAction.READ,
  PermissionAction.UPDATE,
  PermissionAction.DELETE,
];

const READ_ONLY: PermissionAction[] = [PermissionAction.READ];
const CRUD_APPROVE: PermissionAction[] = [...CRUD, PermissionAction.APPROVE];
const CRUD_EXPORT: PermissionAction[] = [...CRUD, PermissionAction.EXPORT];

export const MODULE_ACTIONS: Readonly<Record<AppModule, readonly PermissionAction[]>> = {
  [AppModule.DASHBOARD]: READ_ONLY,
  [AppModule.PRODUCTS]: CRUD_EXPORT,
  [AppModule.SHIPMENTS]: CRUD_EXPORT,
  [AppModule.SHIPMENT_DOCUMENTS]: CRUD,
  [AppModule.SHIPMENT_TRACKING]: CRUD,
  [AppModule.LANDED_COST]: [PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.EXPORT],
  [AppModule.GOODS_RECEIPTS]: CRUD_APPROVE,
  [AppModule.INVENTORY]: [PermissionAction.READ, PermissionAction.EXPORT],
  [AppModule.VENDORS]: CRUD_EXPORT,
  [AppModule.PURCHASE_ORDERS]: CRUD_APPROVE,
  [AppModule.VENDOR_INVOICES]: CRUD_EXPORT,
  [AppModule.VENDOR_PAYMENTS]: CRUD_EXPORT,
  [AppModule.CLEARING_AGENTS]: CRUD,
  [AppModule.AGENT_INVOICES]: CRUD,
  [AppModule.AGENT_PAYMENTS]: CRUD,
  [AppModule.MONEY_CHANGERS]: CRUD,
  [AppModule.CURRENCY_RATES]: CRUD,
  [AppModule.EXPENSES]: CRUD_APPROVE,
  [AppModule.LEDGERS]: [PermissionAction.READ, PermissionAction.EXPORT],
  [AppModule.REPORTS]: [PermissionAction.READ, PermissionAction.EXPORT],
  [AppModule.USERS]: CRUD,
  [AppModule.ROLES]: CRUD,
  [AppModule.SETTINGS]: [PermissionAction.READ, PermissionAction.UPDATE],
  [AppModule.AUDIT_LOGS]: READ_ONLY,
};

export interface PermissionDefinition {
  code: PermissionCode;
  module: AppModule;
  action: PermissionAction;
  description: string;
}

export const PERMISSION_CATALOGUE: readonly PermissionDefinition[] = Object.entries(
  MODULE_ACTIONS,
).flatMap(([module, actions]) =>
  actions.map((action) => ({
    code: permission(module as AppModule, action),
    module: module as AppModule,
    action,
    description: `${action} access for ${module.replace(/_/g, ' ').toLowerCase()}`,
  })),
);

function grant(modules: AppModule[], actions: readonly PermissionAction[]): PermissionCode[] {
  return modules.flatMap((module) =>
    actions
      .filter((action) => MODULE_ACTIONS[module].includes(action))
      .map((action) => permission(module, action)),
  );
}

function readAll(modules: AppModule[]): PermissionCode[] {
  return grant(modules, READ_ONLY);
}

const ALL_MODULES = Object.values(AppModule);

const OPERATIONS_MODULES: AppModule[] = [
  AppModule.PRODUCTS,
  AppModule.SHIPMENTS,
  AppModule.SHIPMENT_DOCUMENTS,
  AppModule.SHIPMENT_TRACKING,
  AppModule.VENDORS,
  AppModule.CLEARING_AGENTS,
  AppModule.PURCHASE_ORDERS,
  AppModule.GOODS_RECEIPTS,
];

const FINANCE_MODULES: AppModule[] = [
  AppModule.VENDOR_INVOICES,
  AppModule.VENDOR_PAYMENTS,
  AppModule.AGENT_INVOICES,
  AppModule.AGENT_PAYMENTS,
  AppModule.EXPENSES,
  AppModule.CURRENCY_RATES,
  AppModule.MONEY_CHANGERS,
];

export const ROLE_PERMISSION_MATRIX: Readonly<Record<RoleCode, readonly PermissionCode[]>> = {
  [RoleCode.ADMIN]: PERMISSION_CATALOGUE.map((entry) => entry.code),

  [RoleCode.OPERATIONS_MANAGER]: [
    ...grant(OPERATIONS_MODULES, CRUD_APPROVE),
    ...grant([AppModule.LANDED_COST], [PermissionAction.READ, PermissionAction.UPDATE]),
    ...readAll([
      AppModule.DASHBOARD,
      AppModule.INVENTORY,
      AppModule.VENDOR_INVOICES,
      AppModule.AGENT_INVOICES,
      AppModule.LEDGERS,
      AppModule.REPORTS,
      AppModule.MONEY_CHANGERS,
    ]),
    permission(AppModule.REPORTS, PermissionAction.EXPORT),
    permission(AppModule.EXPENSES, PermissionAction.CREATE),
    permission(AppModule.EXPENSES, PermissionAction.READ),
  ],

  [RoleCode.FINANCE_MANAGER]: [
    ...grant(FINANCE_MODULES, CRUD_APPROVE),
    ...grant(FINANCE_MODULES, [PermissionAction.EXPORT]),
    ...grant([AppModule.LANDED_COST], [PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.EXPORT]),
    ...readAll([
      AppModule.DASHBOARD,
      AppModule.PRODUCTS,
      AppModule.VENDORS,
      AppModule.CLEARING_AGENTS,
      AppModule.SHIPMENTS,
      AppModule.PURCHASE_ORDERS,
      AppModule.GOODS_RECEIPTS,
      AppModule.INVENTORY,
      AppModule.AUDIT_LOGS,
    ]),
    permission(AppModule.LEDGERS, PermissionAction.READ),
    permission(AppModule.LEDGERS, PermissionAction.EXPORT),
    permission(AppModule.REPORTS, PermissionAction.READ),
    permission(AppModule.REPORTS, PermissionAction.EXPORT),
    permission(AppModule.INVENTORY, PermissionAction.EXPORT),
  ],

  [RoleCode.ACCOUNTANT]: [
    ...grant(FINANCE_MODULES, [
      PermissionAction.CREATE,
      PermissionAction.READ,
      PermissionAction.UPDATE,
    ]),
    ...readAll([
      AppModule.DASHBOARD,
      AppModule.PRODUCTS,
      AppModule.VENDORS,
      AppModule.CLEARING_AGENTS,
      AppModule.SHIPMENTS,
      AppModule.PURCHASE_ORDERS,
      AppModule.GOODS_RECEIPTS,
      AppModule.INVENTORY,
      AppModule.LANDED_COST,
    ]),
    permission(AppModule.LEDGERS, PermissionAction.READ),
    permission(AppModule.LEDGERS, PermissionAction.EXPORT),
    permission(AppModule.REPORTS, PermissionAction.READ),
    permission(AppModule.REPORTS, PermissionAction.EXPORT),
  ],

  [RoleCode.SHIPMENT_MANAGER]: [
    ...grant(
      [
        AppModule.SHIPMENTS,
        AppModule.SHIPMENT_DOCUMENTS,
        AppModule.SHIPMENT_TRACKING,
        AppModule.PRODUCTS,
      ],
      CRUD,
    ),
    ...readAll([
      AppModule.DASHBOARD,
      AppModule.VENDORS,
      AppModule.CLEARING_AGENTS,
      AppModule.PURCHASE_ORDERS,
      AppModule.GOODS_RECEIPTS,
      AppModule.INVENTORY,
      AppModule.LANDED_COST,
      AppModule.REPORTS,
    ]),
    permission(AppModule.REPORTS, PermissionAction.EXPORT),
  ],

  [RoleCode.WAREHOUSE_MANAGER]: [
    ...grant([AppModule.GOODS_RECEIPTS], CRUD_APPROVE),
    ...grant([AppModule.PRODUCTS], [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE]),
    ...readAll([
      AppModule.DASHBOARD,
      AppModule.SHIPMENTS,
      AppModule.VENDORS,
      AppModule.LANDED_COST,
      AppModule.REPORTS,
    ]),
    permission(AppModule.INVENTORY, PermissionAction.READ),
    permission(AppModule.INVENTORY, PermissionAction.EXPORT),
  ],

  [RoleCode.VIEWER]: readAll(
    ALL_MODULES.filter(
      (module) =>
        module !== AppModule.USERS && module !== AppModule.ROLES && module !== AppModule.SETTINGS,
    ),
  ),
};

export const ROLE_DEFINITIONS: Readonly<Record<RoleCode, { name: string; description: string }>> = {
  [RoleCode.ADMIN]: {
    name: 'Administrator',
    description: 'Unrestricted access to every module including user and role administration.',
  },
  [RoleCode.OPERATIONS_MANAGER]: {
    name: 'Operations Manager',
    description: 'Owns imports end to end: shipments, suppliers, orders and goods receipt.',
  },
  [RoleCode.FINANCE_MANAGER]: {
    name: 'Finance Manager',
    description: 'Manages payables, landed cost, ledgers and financial approvals.',
  },
  [RoleCode.ACCOUNTANT]: {
    name: 'Accountant',
    description: 'Records invoices, payments and expenses without approval authority.',
  },
  [RoleCode.SHIPMENT_MANAGER]: {
    name: 'Shipment Manager',
    description: 'Runs the shipment lifecycle, documentation and tracking.',
  },
  [RoleCode.WAREHOUSE_MANAGER]: {
    name: 'Warehouse Manager',
    description: 'Receives goods into stock and maintains the product catalogue.',
  },
  [RoleCode.VIEWER]: {
    name: 'Viewer',
    description: 'Read only visibility across operations, costing and inventory.',
  },
};
