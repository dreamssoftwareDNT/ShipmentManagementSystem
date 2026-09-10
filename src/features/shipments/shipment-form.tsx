'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useOptions } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import { createShipmentSchema, type CreateShipmentInput } from '@/schemas/shipment.schema';
import { ServiceType, ShipmentType, TransportMode } from '@/types/enums';
import { humanise, toDateInputValue } from '@/utils/format';

export interface ShipmentRecord extends Partial<CreateShipmentInput> {
  id: string;
}

const DEFAULTS = {
  customerId: '',
  carrierVendorId: '',
  clearingAgentId: '',
  shipmentType: ShipmentType.IMPORT,
  transportMode: TransportMode.SEA_FCL,
  serviceType: ServiceType.PORT_TO_PORT,
  incoterm: '',
  originCountry: '',
  originPort: '',
  destinationCountry: '',
  destinationPort: '',
  bookingNo: '',
  masterBlNo: '',
  houseBlNo: '',
  vesselName: '',
  voyageNo: '',
  flightNo: '',
  cargoDescription: '',
  commodityCode: '',
  packageCount: 0,
  packageType: '',
  grossWeightKg: 0,
  netWeightKg: 0,
  volumeCbm: 0,
  chargeableWeight: 0,
  declaredValue: 0,
  declaredCurrency: 'USD',
  isHazardous: false,
  requiresTempControl: false,
  bookingDate: '',
  cargoReceivedDate: '',
  shippingDate: '',
  expectedArrival: '',
  baseCurrency: 'USD',
  remarks: '',
};

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

export function ShipmentFormDialog({
  open,
  onClose,
  onSaved,
  shipment,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  shipment?: ShipmentRecord | null;
}) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const { options: customers } = useOptions('customers', open);
  const { options: vendors } = useOptions('vendors', open);
  const { options: agents } = useOptions('clearingAgents', open);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateShipmentInput>({
    resolver: zodResolver(createShipmentSchema),
    defaultValues: DEFAULTS as unknown as CreateShipmentInput,
  });

  const transportMode = watch('transportMode');
  const isAir = transportMode === TransportMode.AIR;

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError(null);

    if (!shipment) {
      reset(DEFAULTS as unknown as CreateShipmentInput);
      return;
    }

    reset({
      ...DEFAULTS,
      ...shipment,
      bookingDate: toDateInputValue(shipment.bookingDate),
      cargoReceivedDate: toDateInputValue(shipment.cargoReceivedDate),
      shippingDate: toDateInputValue(shipment.shippingDate),
      expectedArrival: toDateInputValue(shipment.expectedArrival),
    } as unknown as CreateShipmentInput);
  }, [open, shipment, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const saved = shipment
        ? await apiClient.put<{ id: string; shipmentNo: string }>(
            `/shipments/${shipment.id}`,
            values,
          )
        : await apiClient.post<{ id: string; shipmentNo: string }>('/shipments', values);

      toast.success(shipment ? 'Shipment updated' : 'Shipment created', saved.shipmentNo);
      onSaved(saved.id);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateShipmentInput, { message: messages[0] });
        }
        return;
      }

      setFormError(error instanceof ApiError ? error.message : 'The shipment could not be saved.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={shipment ? 'Edit shipment' : 'New shipment'}
      description="A shipment opens in draft. Confirm the booking to move it into the lifecycle."
      width="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="shipment-form" loading={isSubmitting}>
            {shipment ? 'Save changes' : 'Create shipment'}
          </Button>
        </>
      }
    >
      <form id="shipment-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer" htmlFor="customerId" error={errors.customerId?.message} required>
            <Select id="customerId" invalid={Boolean(errors.customerId)} {...register('customerId')}>
              <option value="">Select a customer</option>
              {customers.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Shipment type" htmlFor="shipmentType" error={errors.shipmentType?.message} required>
            <Select id="shipmentType" {...register('shipmentType')}>
              {Object.values(ShipmentType).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Transport mode" htmlFor="transportMode" error={errors.transportMode?.message} required>
            <Select id="transportMode" {...register('transportMode')}>
              {Object.values(TransportMode).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Service type" htmlFor="serviceType" error={errors.serviceType?.message}>
            <Select id="serviceType" {...register('serviceType')}>
              {Object.values(ServiceType).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Incoterm" htmlFor="incoterm" error={errors.incoterm?.message}>
            <Select id="incoterm" {...register('incoterm')}>
              <option value="">Not set</option>
              {INCOTERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Base currency" htmlFor="baseCurrency" error={errors.baseCurrency?.message}>
            <Input id="baseCurrency" maxLength={3} className="uppercase" {...register('baseCurrency')} />
          </Field>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">Routing</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Origin port" htmlFor="originPort" error={errors.originPort?.message} required>
              <Input id="originPort" invalid={Boolean(errors.originPort)} {...register('originPort')} />
            </Field>
            <Field label="Origin country" htmlFor="originCountry" error={errors.originCountry?.message}>
              <Input id="originCountry" {...register('originCountry')} />
            </Field>
            <Field
              label="Destination port"
              htmlFor="destinationPort"
              error={errors.destinationPort?.message}
              required
            >
              <Input
                id="destinationPort"
                invalid={Boolean(errors.destinationPort)}
                {...register('destinationPort')}
              />
            </Field>
            <Field
              label="Destination country"
              htmlFor="destinationCountry"
              error={errors.destinationCountry?.message}
            >
              <Input id="destinationCountry" {...register('destinationCountry')} />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
            Carrier and documents
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Carrier" htmlFor="carrierVendorId" error={errors.carrierVendorId?.message}>
              <Select id="carrierVendorId" {...register('carrierVendorId')}>
                <option value="">Not assigned</option>
                {vendors.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Clearing agent" htmlFor="clearingAgentId" error={errors.clearingAgentId?.message}>
              <Select id="clearingAgentId" {...register('clearingAgentId')}>
                <option value="">Not assigned</option>
                {agents.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Booking number" htmlFor="bookingNo" error={errors.bookingNo?.message}>
              <Input id="bookingNo" {...register('bookingNo')} />
            </Field>

            <Field
              label={isAir ? 'Master air waybill' : 'Master bill of lading'}
              htmlFor="masterBlNo"
              error={errors.masterBlNo?.message}
            >
              <Input id="masterBlNo" {...register('masterBlNo')} />
            </Field>

            <Field
              label={isAir ? 'House air waybill' : 'House bill of lading'}
              htmlFor="houseBlNo"
              error={errors.houseBlNo?.message}
            >
              <Input id="houseBlNo" {...register('houseBlNo')} />
            </Field>

            {isAir ? (
              <Field label="Flight number" htmlFor="flightNo" error={errors.flightNo?.message}>
                <Input id="flightNo" {...register('flightNo')} />
              </Field>
            ) : (
              <>
                <Field label="Vessel" htmlFor="vesselName" error={errors.vesselName?.message}>
                  <Input id="vesselName" {...register('vesselName')} />
                </Field>
                <Field label="Voyage" htmlFor="voyageNo" error={errors.voyageNo?.message}>
                  <Input id="voyageNo" {...register('voyageNo')} />
                </Field>
              </>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">Cargo</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Packages" htmlFor="packageCount" error={errors.packageCount?.message}>
              <Input id="packageCount" type="number" min={0} {...register('packageCount')} />
            </Field>
            <Field label="Package type" htmlFor="packageType" error={errors.packageType?.message}>
              <Input id="packageType" placeholder="Pallets, cartons" {...register('packageType')} />
            </Field>
            <Field label="Gross weight (kg)" htmlFor="grossWeightKg" error={errors.grossWeightKg?.message}>
              <Input id="grossWeightKg" type="number" step="0.001" min={0} {...register('grossWeightKg')} />
            </Field>
            <Field label="Net weight (kg)" htmlFor="netWeightKg" error={errors.netWeightKg?.message}>
              <Input id="netWeightKg" type="number" step="0.001" min={0} {...register('netWeightKg')} />
            </Field>
            <Field label="Volume (cbm)" htmlFor="volumeCbm" error={errors.volumeCbm?.message}>
              <Input id="volumeCbm" type="number" step="0.001" min={0} {...register('volumeCbm')} />
            </Field>
            <Field
              label="Chargeable weight"
              htmlFor="chargeableWeight"
              error={errors.chargeableWeight?.message}
            >
              <Input
                id="chargeableWeight"
                type="number"
                step="0.001"
                min={0}
                {...register('chargeableWeight')}
              />
            </Field>
            <Field label="Declared value" htmlFor="declaredValue" error={errors.declaredValue?.message}>
              <Input id="declaredValue" type="number" step="0.01" min={0} {...register('declaredValue')} />
            </Field>
            <Field
              label="Declared currency"
              htmlFor="declaredCurrency"
              error={errors.declaredCurrency?.message}
            >
              <Input
                id="declaredCurrency"
                maxLength={3}
                className="uppercase"
                {...register('declaredCurrency')}
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" className="size-4 accent-brand" {...register('isHazardous')} />
              Hazardous cargo
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                {...register('requiresTempControl')}
              />
              Temperature controlled
            </label>
          </div>

          <Field
            label="Cargo description"
            htmlFor="cargoDescription"
            error={errors.cargoDescription?.message}
            className="mt-3"
          >
            <Textarea id="cargoDescription" rows={2} {...register('cargoDescription')} />
          </Field>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">Schedule</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Booking date" htmlFor="bookingDate" error={errors.bookingDate?.message}>
              <Input id="bookingDate" type="date" {...register('bookingDate')} />
            </Field>
            <Field
              label="Cargo received"
              htmlFor="cargoReceivedDate"
              error={errors.cargoReceivedDate?.message}
            >
              <Input id="cargoReceivedDate" type="date" {...register('cargoReceivedDate')} />
            </Field>
            <Field label="Shipping date" htmlFor="shippingDate" error={errors.shippingDate?.message}>
              <Input id="shippingDate" type="date" {...register('shippingDate')} />
            </Field>
            <Field
              label="Estimated arrival"
              htmlFor="expectedArrival"
              error={errors.expectedArrival?.message}
            >
              <Input id="expectedArrival" type="date" {...register('expectedArrival')} />
            </Field>
          </div>
        </section>

        <Field label="Remarks" htmlFor="remarks" error={errors.remarks?.message}>
          <Textarea id="remarks" rows={2} {...register('remarks')} />
        </Field>
      </form>
    </Modal>
  );
}
