import { z } from 'zod';
import { defineRoute } from '@/lib/http/api-handler';
import { customerService } from '@/services/customer.service';
import { vendorService } from '@/services/vendor.service';
import { clearingAgentService } from '@/services/clearing-agent.service';
import { moneyChangerService } from '@/services/money-changer.service';
import { expenseService } from '@/services/expense.service';
import { roleService } from '@/services/user.service';
import { shipmentRepository } from '@/repositories/shipment.repository';
import { currencyRepository } from '@/repositories/currency.repository';
import { AppModule, PermissionAction } from '@/config/permissions';
import { ValidationError } from '@/lib/errors';
import type { SelectOption } from '@/types/common';

const querySchema = z.object({
  set: z.enum([
    'customers',
    'vendors',
    'vendorTypes',
    'clearingAgents',
    'moneyChangers',
    'expenseCategories',
    'roles',
    'shipments',
    'currencies',
  ]),
});

const LOADERS: Record<string, () => Promise<SelectOption[]>> = {
  customers: () => customerService.options(),
  vendors: () => vendorService.options(),
  vendorTypes: () => vendorService.typeOptions(),
  clearingAgents: () => clearingAgentService.options(),
  moneyChangers: () => moneyChangerService.options(),
  expenseCategories: () => expenseService.categoryOptions(),
  roles: () => roleService.options(),
  shipments: async () => {
    const shipments = await shipmentRepository.findAll(
      { status: { notIn: ['CLOSED', 'CANCELLED'] } },
      { orderBy: { createdAt: 'desc' } },
    );

    return shipments.slice(0, 300).map((shipment) => ({
      value: shipment.id,
      label: shipment.shipmentNo,
      hint: `${shipment.originPort} to ${shipment.destinationPort}`,
    }));
  },
  currencies: async () => {
    const currencies = await currencyRepository.listActive();

    return currencies.map((currency) => ({
      value: currency.code,
      label: `${currency.code} - ${currency.name}`,
    }));
  },
};

/**
 * Single endpoint feeding every picker in the application. Read access to the
 * dashboard is enough because the payload is limited to identifiers and labels.
 */
export const GET = defineRoute({
  module: AppModule.DASHBOARD,
  action: PermissionAction.READ,
  querySchema,
  handle: async ({ query }) => {
    const loader = LOADERS[query.set];

    if (!loader) {
      throw new ValidationError(`Unknown option set: ${query.set}`);
    }

    return loader();
  },
});
