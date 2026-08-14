import type { PendingOrder, ReturnInTransit, StockRecord } from "../types.js";

// Timestamps are relative to "now" so the demo always looks fresh, no matter
// when you run it.
function hoursAgo(hours: number): string {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
    return hoursAgo(days * 24);
}

function hoursFromNow(hours: number): string {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// These numbers are written to line up with warehouse-service's seed data —
// see ../../../../scenarios/SCENARIOS.md for the full story per SKU.

export const stock: StockRecord[] = [
    // SKU-001 — stale: last synced before the warehouse's most recent
    // recount, so this number hasn't caught up to the extra stock yet.
    { sku: "SKU-001", quantityAvailable: 38, lastSyncedAt: hoursAgo(18) },

    // SKU-002 — fresh, but derived: 40 on the shelf minus 12 reserved by
    // pending orders below.
    { sku: "SKU-002", quantityAvailable: 28, lastSyncedAt: hoursAgo(1) },

    // SKU-003 — fresh, but derived: 20 physically at the warehouse plus 3
    // already credited back from an in-transit return below.
    { sku: "SKU-003", quantityAvailable: 23, lastSyncedAt: hoursAgo(1) },

    // SKU-004 — fresh, and already correct: 40 on the shelf minus the 8
    // quarantined units the warehouse's own summary hasn't applied yet.
    { sku: "SKU-004", quantityAvailable: 32, lastSyncedAt: hoursAgo(1) },

    // SKU-005 — fresh, and unexplained: nothing below accounts for the
    // 10-unit gap to the warehouse's count. That's the point of this one.
    { sku: "SKU-005", quantityAvailable: 15, lastSyncedAt: hoursAgo(1) },

    // SKU-006 — live on the webshop, but doesn't exist in warehouse-service's
    // `inventory` at all: a newly launched product the warehouse system was
    // never told about, not a stale or disagreeing number.
    { sku: "SKU-006", quantityAvailable: 10, lastSyncedAt: hoursAgo(1) },
];

export const pendingOrders: PendingOrder[] = [
    {
        sku: "SKU-002",
        orderId: "ORD-2201",
        quantity: 7,
        status: "placed",
        placedAt: hoursAgo(4),
    },
    {
        sku: "SKU-002",
        orderId: "ORD-2214",
        quantity: 5,
        status: "picking",
        placedAt: hoursAgo(2),
    },
];

export const returnsInTransit: ReturnInTransit[] = [
    {
        sku: "SKU-003",
        returnId: "RET-3110",
        quantity: 3,
        initiatedAt: daysAgo(2),
        expectedArrivalAt: hoursFromNow(20),
    },
];
