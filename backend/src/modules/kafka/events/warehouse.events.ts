export class BaseWarehouseEvent {
  eventId: string;
  occurredAt: string;
  traceUserId: string;
}

export class GrnConfirmedEvent extends BaseWarehouseEvent {
  grnId: string;
  grnNumber: string;
  supplierId: string;
  warehouseId: string;
  grandTotal: number;
  lines: Array<{
    productId: string;
    locationId: string | null;
    qtyReceived: number;
    unitCost: number;
  }>;
}

export class SoConfirmedEvent extends BaseWarehouseEvent {
  soId: string;
  soNumber: string;
  customerId: string;
  warehouseId: string;
  grandTotal: number;
  lines: Array<{
    productId: string;
    quantity: number;
  }>;
}

export class GdnConfirmedEvent extends BaseWarehouseEvent {
  gdnId: string;
  gdnNumber: string;
  soId: string;
  warehouseId: string;
  lines: Array<{
    productId: string;
    locationId: string | null;
    qtyDelivered: number;
    unitCost: number;
  }>;
}

export class InvoiceConfirmedEvent extends BaseWarehouseEvent {
  invoiceId: string;
  invoiceNumber: string;
  soId: string | null;
  customerId: string;
  grandTotal: number;
  dueDate: string;
}

export class InventoryUpdatedEvent extends BaseWarehouseEvent {
  productId: string;
  warehouseId: string;
  locationId: string | null;
  newQuantity: number;
  newAvgCost: number;
  changeType: 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT';
  refId: string;
}

export const KAFKA_TOPICS = {
  GRN_CONFIRMED: 'grn.confirmed',
  SO_CONFIRMED: 'so.confirmed',
  GDN_CONFIRMED: 'gdn.confirmed',
  INVOICE_CONFIRMED: 'invoice.confirmed',
  INVENTORY_UPDATED: 'inventory.updated',
} as const;
