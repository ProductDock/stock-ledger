// Unit tests for the tools themselves — the parts that don't depend on
// Claude. `fetch` is mocked, so these never make a real network call, and
// the ledger is in-memory (see LEDGER_DB_PATH in package.json's "test"
// script), so they never touch the real stock-ledger.db file.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Confidence, LedgerEntry, RecommendedAction } from "../types.js";
import { buildTools } from "./tools.js";

function mockFetchResolvedOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
}

// buildTools() returns an array, so destructuring loses each tool's specific
// input type — this just finds a tool by name and hands back a narrowly
// typed handle to it.
function getTool<Input>(tools: ReturnType<typeof buildTools>, name: string): { run: (input: Input) => Promise<string> } {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`test setup: no tool named "${name}"`);
  }
  return tool as unknown as { run: (input: Input) => Promise<string> };
}

describe("resolver-agent tools", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("get_wms_stock returns the raw response body on success", async () => {
    mockFetchResolvedOnce(200, { sku: "SKU-001", quantityOnHand: 50 });
    const getWmsStock = getTool<{ sku: string }>(buildTools("claude-sonnet-5", () => {}), "get_wms_stock");

    const result = await getWmsStock.run({ sku: "SKU-001" });

    expect(JSON.parse(result)).toEqual({ sku: "SKU-001", quantityOnHand: 50 });
  });

  it("get_wms_stock throws the service's real error message on a 404", async () => {
    mockFetchResolvedOnce(404, { error: "Unknown SKU: SKU-999" });
    const getWmsStock = getTool<{ sku: string }>(buildTools("claude-sonnet-5", () => {}), "get_wms_stock");

    await expect(getWmsStock.run({ sku: "SKU-999" })).rejects.toThrow("Unknown SKU: SKU-999");
  });

  it("get_wms_stock throws a clear message when the service is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const getWmsStock = getTool<{ sku: string }>(buildTools("claude-sonnet-5", () => {}), "get_wms_stock");

    await expect(getWmsStock.run({ sku: "SKU-001" })).rejects.toThrow(/Could not reach/);
  });

  it("record_resolution stores null for a SKU missing from one system instead of failing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // get_wms_stock's own inventory lookup — used first, by array order
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "Unknown SKU: SKU-006" }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ quantityAvailable: 10 }) }),
    );

    let recorded: LedgerEntry | undefined;
    const tools = buildTools("claude-sonnet-5", (entry) => {
      recorded = entry;
    });
    const recordResolution = getTool<{
      sku: string;
      resolvedQty: number;
      confidence: Confidence;
      recommendedAction: RecommendedAction;
      reasoning: string;
    }>(tools, "record_resolution");

    const result = await recordResolution.run({
      sku: "SKU-006",
      resolvedQty: 10,
      confidence: "low",
      recommendedAction: "needs_human_review",
      reasoning: "Warehouse has no record of this SKU.",
    });

    expect(result).toBe("Resolution recorded.");
    expect(recorded).toMatchObject({
      sku: "SKU-006",
      model: "claude-sonnet-5",
      wmsQty: null,
      storefrontQty: 10,
      resolvedQty: 10,
      recommendedAction: "needs_human_review",
    });
  });
});
