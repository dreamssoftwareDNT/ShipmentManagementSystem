import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ShipmentDocument } from '@prisma/client';
import { BaseService } from './base.service';
import { shipmentDocumentRepository } from '@/repositories/shipment-document.repository';
import { shipmentRepository } from '@/repositories/shipment.repository';
import { UnitOfWork } from '@/database/unit-of-work';
import { getEnv } from '@/config/env';
import { BusinessRuleError, NotFoundError, ValidationError } from '@/lib/errors';
import { AuditAction } from '@/types/enums';
import type { ShipmentDocumentMetaInput } from '@/schemas/shipment.schema';
import type { RequestContext } from '@/types/common';

const ALLOWED_MIME_TYPES = new Map<string, string>([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.ms-excel', '.xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
]);

const MAGIC_NUMBERS: Array<{ mime: string; signature: number[] }> = [
  { mime: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
];

export interface UploadedFile {
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface StoredDocument {
  document: ShipmentDocument;
}

/**
 * Shipment document storage.
 *
 * Files are written under a generated key rather than the client supplied name
 * so a hostile filename can never escape the upload root, and the declared MIME
 * type is checked against the file's own magic number where one exists.
 */
export class DocumentService extends BaseService {
  private readonly entityName = 'Shipment document';

  async upload(
    shipmentId: string,
    meta: ShipmentDocumentMetaInput,
    file: UploadedFile,
    context: RequestContext,
  ): Promise<ShipmentDocument> {
    const env = getEnv();

    this.assertAcceptable(file, env.UPLOAD_MAX_BYTES);

    const shipment = await shipmentRepository.requireById(shipmentId);
    const extension = ALLOWED_MIME_TYPES.get(file.mimeType) ?? '';
    const storageKey = path.posix.join(
      'shipments',
      shipmentId,
      `${randomUUID()}${extension}`,
    );

    const absolutePath = this.resolveAbsolutePath(storageKey, env.UPLOAD_ROOT);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    try {
      return await UnitOfWork.run(async (tx) => {
        const version = await shipmentDocumentRepository.nextVersion(
          shipmentId,
          meta.documentType,
          tx,
        );

        const document = await shipmentDocumentRepository.create(
          {
            shipmentId,
            documentType: meta.documentType,
            title: meta.title,
            fileName: this.sanitiseFileName(file.fileName),
            storageKey,
            mimeType: file.mimeType,
            fileSize: file.size,
            checksum: createHash('sha256').update(file.buffer).digest('hex'),
            version,
            issuedDate: meta.issuedDate ?? null,
            expiryDate: meta.expiryDate ?? null,
            remarks: meta.remarks ?? null,
          },
          { userId: context.user.id },
          tx,
        );

        await this.writeAudit(
          context,
          {
            entityName: this.entityName,
            entityId: document.id,
            action: AuditAction.UPLOAD,
            summary: `Uploaded ${meta.documentType.replace(/_/g, ' ').toLowerCase()} to ${shipment.shipmentNo}`,
          },
          tx,
        );

        return document;
      });
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }
  }

  async read(documentId: string): Promise<{ document: ShipmentDocument; content: Buffer }> {
    const document = await shipmentDocumentRepository.findById(documentId);

    if (!document) {
      throw new NotFoundError(this.entityName, documentId);
    }

    const absolutePath = this.resolveAbsolutePath(document.storageKey, getEnv().UPLOAD_ROOT);

    try {
      const content = await readFile(absolutePath);
      return { document, content };
    } catch {
      throw new NotFoundError('Stored file', document.fileName);
    }
  }

  async listForShipment(shipmentId: string): Promise<ShipmentDocument[]> {
    return shipmentDocumentRepository.listForShipment(shipmentId);
  }

  async remove(documentId: string, context: RequestContext): Promise<void> {
    const document = await shipmentDocumentRepository.requireById(documentId);

    await shipmentDocumentRepository.softDelete(documentId, { userId: context.user.id });

    await this.writeAudit(context, {
      entityName: this.entityName,
      entityId: documentId,
      action: AuditAction.DELETE,
      summary: `Removed document ${document.fileName}`,
    });
  }

  private assertAcceptable(file: UploadedFile, maxBytes: number): void {
    if (file.size <= 0) {
      throw new ValidationError('The uploaded file is empty', { file: ['The file is empty'] });
    }

    if (file.size > maxBytes) {
      const limitMb = Math.floor(maxBytes / 1_048_576);
      throw new ValidationError(`Files must be ${limitMb} MB or smaller`, {
        file: [`Files must be ${limitMb} MB or smaller`],
      });
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
      throw new ValidationError(`${file.mimeType} files are not accepted`, {
        file: ['Only PDF, image, Word and Excel documents are accepted'],
      });
    }

    const expected = MAGIC_NUMBERS.find((entry) => entry.mime === file.mimeType);

    if (expected) {
      const matches = expected.signature.every(
        (byte, index) => file.buffer[index] === byte,
      );

      if (!matches) {
        throw new BusinessRuleError(
          'The file content does not match its declared type and was rejected',
        );
      }
    }
  }

  private sanitiseFileName(fileName: string): string {
    return path
      .basename(fileName)
      .replace(/[^A-Za-z0-9._ -]/g, '_')
      .slice(0, 255);
  }

  private resolveAbsolutePath(storageKey: string, uploadRoot: string): string {
    const root = path.resolve(process.cwd(), uploadRoot);
    const target = path.resolve(root, storageKey);

    if (!target.startsWith(root + path.sep)) {
      throw new BusinessRuleError('Invalid storage location');
    }

    return target;
  }
}

export const documentService = new DocumentService();
