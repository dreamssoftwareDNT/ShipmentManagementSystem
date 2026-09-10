import type { ShipmentDocument, ShipmentTrackingEvent } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import type { DatabaseClient } from '@/database/unit-of-work';

export class ShipmentDocumentRepository extends BaseRepository<ShipmentDocument> {
  protected readonly entityName = 'Shipment document';

  protected delegate(client: DatabaseClient): ModelDelegate<ShipmentDocument> {
    return client.shipmentDocument as unknown as ModelDelegate<ShipmentDocument>;
  }

  async listForShipment(shipmentId: string, client?: DatabaseClient): Promise<ShipmentDocument[]> {
    return this.findAll({ shipmentId }, { orderBy: { createdAt: 'desc' } }, client);
  }

  async nextVersion(
    shipmentId: string,
    documentType: string,
    client?: DatabaseClient,
  ): Promise<number> {
    const latest = await this.findOne(
      { shipmentId, documentType },
      { orderBy: { version: 'desc' } },
      client,
    );

    return (latest?.version ?? 0) + 1;
  }
}

export class ShipmentTrackingRepository extends BaseRepository<ShipmentTrackingEvent> {
  protected readonly entityName = 'Tracking event';

  protected delegate(client: DatabaseClient): ModelDelegate<ShipmentTrackingEvent> {
    return client.shipmentTrackingEvent as unknown as ModelDelegate<ShipmentTrackingEvent>;
  }

  async listForShipment(
    shipmentId: string,
    client?: DatabaseClient,
  ): Promise<ShipmentTrackingEvent[]> {
    return this.findAll({ shipmentId }, { orderBy: { occurredAt: 'desc' } }, client);
  }
}

export const shipmentDocumentRepository = new ShipmentDocumentRepository();
export const shipmentTrackingRepository = new ShipmentTrackingRepository();
