// Mirrors the shapes documented in openapi.yaml — see that file for the
// "why does this field look the way it does" explanations.

export interface StockRecord {
  sku: string;
  quantityAvailable: number;
  lastSyncedAt: string;
}

export type OrderStatus = "placed" | "picking" | "shipped";

export interface PendingOrder {
  sku: string;
  orderId: string;
  quantity: number;
  status: OrderStatus;
  placedAt: string;
}

export interface ReturnInTransit {
  sku: string;
  returnId: string;
  quantity: number;
  initiatedAt: string;
  expectedArrivalAt: string;
}
