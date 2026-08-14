// Mirrors the shapes documented in openapi.yaml — see that file for the
// "why does this field look the way it does" explanations.

export interface InventoryRecord {
  sku: string;
  quantityOnHand: number;
  lastCountedAt: string;
  location: string;
}

export type MovementType = "cycle_count" | "adjustment" | "quarantine" | "release";

export interface StockMovement {
  sku: string;
  occurredAt: string;
  type: MovementType;
  quantityDelta: number;
  note: string;
}
