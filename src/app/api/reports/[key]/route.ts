import { z } from 'zod';
import { reportService } from '@/services/report.service';
import { requestContext } from '@/lib/auth/session';
import { AccessControl } from '@/lib/security/access-control';
import { handleRouteError } from '@/lib/http/api-handler';
import { AppModule, PermissionAction } from '@/config/permissions';
import { NextResponse } from 'next/server';

const filterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  customerId: z.string().max(30).optional(),
  vendorId: z.string().max(30).optional(),
  status: z.string().max(40).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

interface RouteContext {
  params: Promise<{ key: string }>;
}

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const context = await requestContext();
    const access = new AccessControl(context.user);
    const { key } = await routeContext.params;
    const url = new URL(request.url);
    const filter = filterSchema.parse(Object.fromEntries(url.searchParams.entries()));

    access.assert(
      AppModule.REPORTS,
      filter.format === 'csv' ? PermissionAction.EXPORT : PermissionAction.READ,
    );

    const report = await reportService.run(key, filter);

    if (filter.format === 'csv') {
      return new Response(reportService.toCsv(report), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${report.key}-${report.generatedAt
            .toISOString()
            .slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return handleRouteError(error);
  }
}
