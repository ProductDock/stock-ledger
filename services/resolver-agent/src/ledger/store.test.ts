// Unit tests for the ledger itself — no LLM involved. Runs against an
// in-memory database (see LEDGER_DB_PATH in package.json's "test" script),
// so it never touches the real stock-ledger.db file.

import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "../types.js";
import { getAllLedgerEntries, getLedgerForSku, insertLedgerEntry } from "./store.js";

function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    sku: "SKU-TEST",
    timestamp: new Date().toISOString(),
    model: "claude-sonnet-5",
    wmsQty: 10,
    storefrontQty: 8,
    resolvedQty: 10,
    confidence: "high",
    recommendedAction: "trust_wms",
    reasoning: "test reasoning",
    ...overrides,
  };
}

describe("ledger store", () => {
  it("round-trips a full entry through insertLedgerEntry and getLedgerForSku", () => {
    const entry = makeEntry({ sku: "SKU-A" });
    insertLedgerEntry(entry);
    expect(getLedgerForSku("SKU-A")).toEqual([entry]);
  });

  it("stores a null wmsQty/storefrontQty, e.g. a SKU missing from one system", () => {
    const entry = makeEntry({ sku: "SKU-B", wmsQty: null });
    insertLedgerEntry(entry);
    expect(getLedgerForSku("SKU-B")[0].wmsQty).toBeNull();
  });

  it("returns a SKU's history most-recent-first", () => {
    insertLedgerEntry(makeEntry({ sku: "SKU-C", timestamp: "2026-01-01T00:00:00.000Z", resolvedQty: 1 }));
    insertLedgerEntry(makeEntry({ sku: "SKU-C", timestamp: "2026-01-02T00:00:00.000Z", resolvedQty: 2 }));
    const history = getLedgerForSku("SKU-C");
    expect(history.map((entry) => entry.resolvedQty)).toEqual([2, 1]);
  });

  it("returns an empty array for a SKU with no recorded resolutions", () => {
    expect(getLedgerForSku("SKU-NEVER-RESOLVED")).toEqual([]);
  });

  it("getAllLedgerEntries includes entries across different SKUs", () => {
    insertLedgerEntry(makeEntry({ sku: "SKU-D" }));
    insertLedgerEntry(makeEntry({ sku: "SKU-E" }));
    const skus = getAllLedgerEntries().map((entry) => entry.sku);
    expect(skus).toContain("SKU-D");
    expect(skus).toContain("SKU-E");
  });
});
