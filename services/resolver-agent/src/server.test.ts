// Route tests with resolveSku mocked out — these check the HTTP layer
// (status codes, response shapes) without ever calling Claude. The ledger
// itself is in-memory (see LEDGER_DB_PATH in package.json's "test" script).

import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSku } from "./agent/runner.js";
import type { LedgerEntry } from "./types.js";

vi.mock("./agent/runner.js", () => ({ resolveSku: vi.fn() }));

const { app } = await import("./server.js");

const sampleEntry: LedgerEntry = {
  sku: "SKU-001",
  timestamp: "2026-01-01T00:00:00.000Z",
  model: "claude-sonnet-5",
  wmsQty: 50,
  storefrontQty: 38,
  resolvedQty: 50,
  confidence: "high",
  recommendedAction: "trust_wms",
  reasoning: "test reasoning",
};

describe("resolver-agent routes", () => {
  beforeEach(() => {
    vi.mocked(resolveSku).mockReset();
  });

  it("POST /resolve/:sku returns the resolved ledger entry", async () => {
    vi.mocked(resolveSku).mockResolvedValue(sampleEntry);

    const res = await request(app).post("/resolve/SKU-001");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(sampleEntry);
    expect(resolveSku).toHaveBeenCalledWith("SKU-001");
  });

  it("POST /resolve/:sku returns 500 with the real error message when resolveSku throws", async () => {
    vi.mocked(resolveSku).mockRejectedValue(new Error("Could not reach global-wms-service"));

    const res = await request(app).post("/resolve/SKU-001");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Could not reach global-wms-service" });
  });

  it("GET /ledger/:sku returns latest: null and an empty history for an unresolved SKU", async () => {
    const res = await request(app).get("/ledger/SKU-999");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ latest: null, history: [] });
  });

  it("GET /ledger returns an array", async () => {
    const res = await request(app).get("/ledger");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
