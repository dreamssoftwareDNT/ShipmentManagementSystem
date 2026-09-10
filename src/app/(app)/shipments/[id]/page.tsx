import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { MetricCard } from '@/components/layout/metric-card';
import { StatusPill } from '@/components/ui/status-pill';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { LifecycleTracker } from '@/features/shipments/lifecycle-tracker';
import { ShipmentCharges } from '@/features/shipments/shipment-charges';
import { ShipmentDocuments } from '@/features/shipments/shipment-documents';
import { shipmentService } from '@/services/shipment.service';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';
import { NotFoundError } from '@/lib/errors';
import { formatAmount, formatDate, formatDateTime, humanise } from '@/utils/format';

export const metadata: Metadata = { title: 'Shipment' };
export const dynamic = 'force-dynamic';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-1.5 last:border-b-0">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="text-right text-sm text-ink">{value || '--'}</dd>
    </div>
  );
}

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await guardPage(AppModule.SHIPMENTS, PermissionAction.READ);
  const access = accessControl(user);
  const { id } = await params;

  const shipment = await shipmentService.getDetail(id).catch((error: unknown) => {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  });

  const profitability = await shipmentService.profitability(id);
  const isAir = shipment.transportMode === 'AIR';

  return (
    <>
      <PageHeader
        title={shipment.shipmentNo}
        description={`${shipment.originPort} to ${shipment.destinationPort} for ${shipment.customer.name}`}
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Shipments', href: '/shipments' },
          { label: shipment.shipmentNo },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {shipment.isHazardous ? <Badge tone="critical">Hazardous</Badge> : null}
            {shipment.requiresTempControl ? <Badge tone="info">Reefer</Badge> : null}
            <StatusPill status={shipment.status} />
          </div>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <LifecycleTracker
            shipmentId={shipment.id}
            currentStatus={shipment.status}
            canAdvance={access.can(AppModule.SHIPMENTS, PermissionAction.UPDATE)}
          />
        </CardBody>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Estimated revenue" prefix="$" value={formatAmount(profitability.estimatedRevenue.toString())} />
        <MetricCard label="Realised revenue" prefix="$" value={formatAmount(profitability.actualRevenue.toString())} intent="positive" />
        <MetricCard label="Realised cost" prefix="$" value={formatAmount(profitability.actualCost.toString())} intent="negative" />
        <MetricCard
          label="Realised profit"
          prefix="$"
          value={formatAmount(profitability.actualProfit.toString())}
          changeLabel={`Margin ${profitability.marginPercent.toString()} percent`}
          intent={profitability.actualProfit.isNegative() ? 'negative' : 'positive'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Booking" />
          <CardBody className="pt-1">
            <dl>
              <DetailRow label="Customer" value={shipment.customer.name} />
              <DetailRow label="Shipment type" value={humanise(shipment.shipmentType)} />
              <DetailRow label="Transport mode" value={humanise(shipment.transportMode)} />
              <DetailRow label="Service" value={humanise(shipment.serviceType)} />
              <DetailRow label="Incoterm" value={shipment.incoterm} />
              <DetailRow label="Carrier" value={shipment.carrier?.name} />
              <DetailRow label="Clearing agent" value={shipment.clearingAgent?.name} />
              <DetailRow label="Booking number" value={shipment.bookingNo} />
              <DetailRow
                label={isAir ? 'Master air waybill' : 'Master bill of lading'}
                value={shipment.masterBlNo}
              />
              <DetailRow
                label={isAir ? 'House air waybill' : 'House bill of lading'}
                value={shipment.houseBlNo}
              />
              <DetailRow
                label={isAir ? 'Flight' : 'Vessel and voyage'}
                value={
                  isAir
                    ? shipment.flightNo
                    : [shipment.vesselName, shipment.voyageNo].filter(Boolean).join(' / ')
                }
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cargo" />
          <CardBody className="pt-1">
            <dl>
              <DetailRow
                label="Packages"
                value={`${shipment.packageCount} ${shipment.packageType ?? ''}`.trim()}
              />
              <DetailRow label="Gross weight" value={`${formatAmount(shipment.grossWeightKg.toString(), 3)} kg`} />
              <DetailRow label="Net weight" value={`${formatAmount(shipment.netWeightKg.toString(), 3)} kg`} />
              <DetailRow label="Volume" value={`${formatAmount(shipment.volumeCbm.toString(), 3)} cbm`} />
              <DetailRow
                label="Chargeable weight"
                value={`${formatAmount(shipment.chargeableWeight.toString(), 3)} kg`}
              />
              <DetailRow
                label="Declared value"
                value={`${shipment.declaredCurrency} ${formatAmount(shipment.declaredValue.toString())}`}
              />
              <DetailRow label="Commodity code" value={shipment.commodityCode} />
            </dl>
            {shipment.cargoDescription ? (
              <p className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-xs leading-relaxed text-ink-muted">
                {shipment.cargoDescription}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Schedule" />
          <CardBody className="pt-1">
            <dl>
              <DetailRow label="Booked" value={formatDate(shipment.bookingDate)} />
              <DetailRow label="Cargo received" value={formatDate(shipment.cargoReceivedDate)} />
              <DetailRow label="Shipped" value={formatDate(shipment.shippingDate)} />
              <DetailRow label="Estimated arrival" value={formatDate(shipment.expectedArrival)} />
              <DetailRow label="Actual arrival" value={formatDate(shipment.actualArrival)} />
              <DetailRow label="Cleared" value={formatDate(shipment.clearanceDate)} />
              <DetailRow label="Delivered" value={formatDate(shipment.deliveryDate)} />
              <DetailRow label="Closed" value={formatDate(shipment.closedAt)} />
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ShipmentCharges
          shipmentId={shipment.id}
          charges={shipment.charges.map((charge) => ({
            id: charge.id,
            chargeType: charge.chargeType,
            description: charge.description,
            quantity: charge.quantity.toString(),
            unitRate: charge.unitRate.toString(),
            currencyCode: charge.currencyCode,
            amount: charge.amount.toString(),
            baseAmount: charge.baseAmount.toString(),
          }))}
          canEdit={access.can(AppModule.SHIPMENTS, PermissionAction.UPDATE)}
        />

        <Card>
          <CardHeader
            title="Containers"
            description={`${shipment.containers.length} attached to this shipment`}
          />
          {shipment.containers.length === 0 ? (
            <EmptyState title="No containers attached" />
          ) : (
            <div className="data-grid-scroll">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-muted text-xs tracking-wide text-ink-subtle uppercase">
                    <th className="px-3 py-2 text-left">Container</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Seal</th>
                    <th className="px-3 py-2 text-right">Gross kg</th>
                    <th className="px-3 py-2 text-right">Cbm</th>
                  </tr>
                </thead>
                <tbody>
                  {shipment.containers.map((container) => (
                    <tr key={container.id} className="border-b border-border-subtle last:border-b-0">
                      <td className="px-3 py-2 font-medium">{container.containerNo}</td>
                      <td className="px-3 py-2">{container.containerType}</td>
                      <td className="px-3 py-2 text-ink-muted">{container.sealNo ?? '--'}</td>
                      <td className="numeric px-3 py-2 text-right">
                        {formatAmount(container.grossWeightKg.toString(), 3)}
                      </td>
                      <td className="numeric px-3 py-2 text-right">
                        {formatAmount(container.volumeCbm.toString(), 3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ShipmentDocuments
          shipmentId={shipment.id}
          documents={shipment.documents.map((document) => ({
            id: document.id,
            documentType: document.documentType,
            title: document.title,
            fileName: document.fileName,
            fileSize: document.fileSize,
            version: document.version,
            createdAt: document.createdAt.toISOString(),
          }))}
          canUpload={access.can(AppModule.SHIPMENT_DOCUMENTS, PermissionAction.CREATE)}
          canDelete={access.can(AppModule.SHIPMENT_DOCUMENTS, PermissionAction.DELETE)}
        />

        <Card>
          <CardHeader title="Tracking and history" description="Newest events first." />
          {shipment.trackingEvents.length === 0 && shipment.statusHistory.length === 0 ? (
            <EmptyState title="No events recorded yet" />
          ) : (
            <ol className="divide-y divide-border-subtle">
              {shipment.trackingEvents.map((event) => (
                <li key={event.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{event.description}</p>
                      <p className="text-xs text-ink-muted">
                        {humanise(event.eventCode)}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-subtle">
                      {formatDateTime(event.occurredAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
