import { z } from 'zod';
import { defineRoute } from '@/lib/http/api-handler';
import { ledgerService } from '@/services/ledger.service';
import { pageRequestSchema } from '@/schemas/common.schema';
import { AppModule, PermissionAction } from '@/config/permissions';
import { LedgerPartyType, enumValues } from '@/types/enums';
import { ValidationError } from '@/lib/errors';

const querySchema = pageRequestSchema.extend({
  currencyCode: z.string().trim().length(3).default('USD'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const partyTypeSchema = z.enum(enumValues(LedgerPartyType));

export const GET = defineRoute({
  module: AppModule.LEDGERS,
  action: PermissionAction.READ,
  querySchema,
  handle: async ({ params, query }) => {
    const parsedPartyType = partyTypeSchema.safeParse(params.partyType?.toUpperCase());

    if (!parsedPartyType.success) {
      throw new ValidationError('Unknown ledger party type');
    }

    const statement = await ledgerService.getStatement(
      parsedPartyType.data as LedgerPartyType,
      params.partyId as string,
      query.currencyCode.toUpperCase(),
      {
        page: query.page,
        pageSize: query.pageSize,
        sortDirection: query.sortDirection,
      },
      { from: query.from, to: query.to },
    );

    return statement ?? { account: null, rows: [], openingBalance: '0', closingBalance: '0' };
  },
});
