import { NextResponse } from 'next/server';
import { documentService } from '@/services/document.service';
import { shipmentDocumentMetaSchema } from '@/schemas/shipment.schema';
import { handleRouteError } from '@/lib/http/api-handler';
import { requestContext } from '@/lib/auth/session';
import { AccessControl } from '@/lib/security/access-control';
import { AppModule, PermissionAction } from '@/config/permissions';
import { ValidationError } from '@/lib/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, routeContext: RouteContext) {
  try {
    const context = await requestContext();
    new AccessControl(context.user).assert(AppModule.SHIPMENT_DOCUMENTS, PermissionAction.READ);

    const { id } = await routeContext.params;
    const documents = await documentService.listForShipment(id);

    return NextResponse.json({ success: true, data: documents });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    const context = await requestContext();
    new AccessControl(context.user).assert(AppModule.SHIPMENT_DOCUMENTS, PermissionAction.CREATE);

    const { id } = await routeContext.params;
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      throw new ValidationError('A file is required', { file: ['Choose a file to upload'] });
    }

    const meta = shipmentDocumentMetaSchema.parse({
      documentType: form.get('documentType'),
      title: form.get('title'),
      issuedDate: form.get('issuedDate') || null,
      expiryDate: form.get('expiryDate') || null,
      remarks: form.get('remarks') || null,
    });

    const document = await documentService.upload(
      id,
      meta,
      {
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        buffer: Buffer.from(await file.arrayBuffer()),
      },
      context,
    );

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
