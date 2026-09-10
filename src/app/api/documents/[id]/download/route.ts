import { documentService } from '@/services/document.service';
import { handleRouteError } from '@/lib/http/api-handler';
import { requestContext } from '@/lib/auth/session';
import { AccessControl } from '@/lib/security/access-control';
import { AppModule, PermissionAction } from '@/config/permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, routeContext: RouteContext) {
  try {
    const context = await requestContext();
    new AccessControl(context.user).assert(AppModule.SHIPMENT_DOCUMENTS, PermissionAction.READ);

    const { id } = await routeContext.params;
    const { document, content } = await documentService.read(id);

    return new Response(new Uint8Array(content), {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Length': String(content.byteLength),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(document.fileName)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
