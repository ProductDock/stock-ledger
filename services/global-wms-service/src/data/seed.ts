import type { InventoryRecord, StockMovement } from "../types.js";

// Timestamps are relative to "now" so the demo always looks fresh, no matter
// when you run it — hours/days ago rather than fixed calendar dates.
function hoursAgo(hours: number): string {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// Six SKUs, six different reasons the warehouse and webshop numbers can
// disagree. See ../../../../scenarios/SCENARIOS.md for the full explanation
export const inventory: InventoryRecord[] = [
    {
        sku: "SKU-001",
        quantityOnHand: 50,
        lastCountedAt: hoursAgo(2),
        location: "A1",
    },
    {
        sku: "SKU-002",
        quantityOnHand: 40,
        lastCountedAt: hoursAgo(5),
        location: "B3",
    },
    {
        sku: "SKU-003",
        quantityOnHand: 20,
        lastCountedAt: hoursAgo(3),
        location: "C2",
    },
    {
        sku: "SKU-004",
        quantityOnHand: 40,
        lastCountedAt: hoursAgo(6),
        location: "D4",
    },
    {
        sku: "SKU-005",
        quantityOnHand: 25,
        lastCountedAt: hoursAgo(1),
        location: "E5",
    },
];

export const movements: StockMovement[] = [
    // SKU-001 — sync lag: a recount found more stock than expected, but the
    // webshop hasn't pulled a fresh number since.
    {
        sku: "SKU-001",
        occurredAt: hoursAgo(2),
        type: "cycle_count",
        quantityDelta: 12,
        note: "Recount after a restock; found 12 more units than the previous count.",
    },

    // SKU-002 — nothing unusual here. The whole story for this SKU lives on
    // the webshop side (pending orders reserving stock).
    {
        sku: "SKU-002",
        occurredAt: hoursAgo(5),
        type: "cycle_count",
        quantityDelta: 0,
        note: "Routine cycle count, no change from the previous count.",
    },

    // SKU-003 — nothing unusual here either. The story is a return credited
    // on the webshop side that hasn't physically arrived yet.
    {
        sku: "SKU-003",
        occurredAt: hoursAgo(3),
        type: "cycle_count",
        quantityDelta: 0,
        note: "Routine cycle count, matches the previous count.",
    },

    // SKU-004 — quarantine event recorded after the last cycle count. The
    // quantityOnHand above (40) has NOT been reduced by this yet — that only
    // happens at the next cycle count.
    {
        sku: "SKU-004",
        occurredAt: hoursAgo(6),
        type: "cycle_count",
        quantityDelta: 0,
        note: "Routine cycle count.",
    },
    {
        sku: "SKU-004",
        occurredAt: hoursAgo(1),
        type: "quarantine",
        quantityDelta: -8,
        note: "8 units found damaged during a spot inspection and pulled aside. Not yet reflected in quantityOnHand — the next cycle count will apply it.",
    },

    // SKU-005 — deliberately unremarkable. Nothing here explains a large gap
    // to the webshop's number; that's the point of this scenario.
    {
        sku: "SKU-005",
        occurredAt: hoursAgo(1),
        type: "cycle_count",
        quantityDelta: -1,
        note: "Routine cycle count, one unit fewer than expected — within normal counting variance.",
    },
];
