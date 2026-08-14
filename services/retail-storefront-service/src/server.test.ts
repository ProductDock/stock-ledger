// A "contract test" — it doesn't check business logic, it checks that real
// responses from this service actually match the shapes promised in
// openapi.yaml. If someone changes a field without updating the spec (or
// vice versa), this is what catches it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import yaml from "js-yaml";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.resolve(__dirname, "../openapi.yaml");
const spec = yaml.load(fs.readFileSync(specPath, "utf8")) as {
  components: { schemas: Record<string, object> };
};

const ajv = new Ajv({ strict: false });
for (const [name, schema] of Object.entries(spec.components.schemas)) {
  ajv.addSchema(schema, name);
}

function expectMatchesSchema(body: unknown, schemaName: string): void {
  const validate = ajv.getSchema(schemaName);
  if (!validate) {
    throw new Error(`openapi.yaml has no schema named ${schemaName}`);
  }
  const isValid = validate(body);
  if (!isValid) {
    throw new Error(
      `Response did not match the ${schemaName} schema:\n${JSON.stringify(validate.errors, null, 2)}`,
    );
  }
}

describe("retail-storefront-service contract", () => {
  it("GET /stock returns records matching StockRecord", async () => {
    const res = await request(app).get("/stock");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const record of res.body) {
      expectMatchesSchema(record, "StockRecord");
    }
  });

  it("GET /stock/:sku returns a record matching StockRecord", async () => {
    const res = await request(app).get("/stock/SKU-002");
    expect(res.status).toBe(200);
    expectMatchesSchema(res.body, "StockRecord");
  });

  it("GET /stock/:sku returns 404 with an Error body for an unknown SKU", async () => {
    const res = await request(app).get("/stock/SKU-999");
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });

  it("GET /orders/pending returns entries matching PendingOrder", async () => {
    const res = await request(app).get("/orders/pending?sku=SKU-002");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const order of res.body) {
      expectMatchesSchema(order, "PendingOrder");
    }
  });

  it("GET /orders/pending returns 400 with an Error body when sku is missing", async () => {
    const res = await request(app).get("/orders/pending");
    expect(res.status).toBe(400);
    expectMatchesSchema(res.body, "Error");
  });

  it("GET /returns/in-transit returns entries matching ReturnInTransit", async () => {
    const res = await request(app).get("/returns/in-transit?sku=SKU-003");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const entry of res.body) {
      expectMatchesSchema(entry, "ReturnInTransit");
    }
  });

  it("GET /returns/in-transit returns 400 with an Error body when sku is missing", async () => {
    const res = await request(app).get("/returns/in-transit");
    expect(res.status).toBe(400);
    expectMatchesSchema(res.body, "Error");
  });
});

describe("retail-storefront-service write endpoints", () => {
  it("POST /stock creates a record and returns it matching StockRecord", async () => {
    const res = await request(app).post("/stock").send({
      sku: "SKU-TEST-CREATE",
      quantityAvailable: 5,
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(res.status).toBe(201);
    expectMatchesSchema(res.body, "StockRecord");

    const getRes = await request(app).get("/stock/SKU-TEST-CREATE");
    expect(getRes.status).toBe(200);
    expect(getRes.body.quantityAvailable).toBe(5);
  });

  it("POST /stock returns 400 with an Error body for a malformed request", async () => {
    const res = await request(app).post("/stock").send({ sku: "SKU-TEST-BAD" });
    expect(res.status).toBe(400);
    expectMatchesSchema(res.body, "Error");
  });

  it("POST /stock returns 409 with an Error body for a SKU that already exists", async () => {
    const res = await request(app).post("/stock").send({
      sku: "SKU-002",
      quantityAvailable: 1,
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(res.status).toBe(409);
    expectMatchesSchema(res.body, "Error");
  });

  it("PUT /stock/:sku updates a record and returns it matching StockRecord", async () => {
    await request(app).post("/stock").send({
      sku: "SKU-TEST-UPDATE",
      quantityAvailable: 5,
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
    });

    const res = await request(app).put("/stock/SKU-TEST-UPDATE").send({
      quantityAvailable: 9,
      lastSyncedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(res.status).toBe(200);
    expectMatchesSchema(res.body, "StockRecord");
    expect(res.body.quantityAvailable).toBe(9);
  });

  it("PUT /stock/:sku returns 404 with an Error body for an unknown SKU", async () => {
    const res = await request(app).put("/stock/SKU-TEST-MISSING").send({
      quantityAvailable: 1,
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });

  it("DELETE /stock/:sku removes the record", async () => {
    await request(app).post("/stock").send({
      sku: "SKU-TEST-DELETE",
      quantityAvailable: 5,
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
    });

    const res = await request(app).delete("/stock/SKU-TEST-DELETE");
    expect(res.status).toBe(204);

    const getRes = await request(app).get("/stock/SKU-TEST-DELETE");
    expect(getRes.status).toBe(404);
  });

  it("DELETE /stock/:sku returns 404 with an Error body for an unknown SKU", async () => {
    const res = await request(app).delete("/stock/SKU-TEST-MISSING");
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });

  it("POST /orders/pending creates an order and returns it matching PendingOrder", async () => {
    const res = await request(app).post("/orders/pending").send({
      sku: "SKU-001",
      orderId: "ORD-TEST-CREATE",
      quantity: 3,
      status: "placed",
      placedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(res.status).toBe(201);
    expectMatchesSchema(res.body, "PendingOrder");
  });

  it("POST /orders/pending returns 400 with an Error body for a malformed request", async () => {
    const res = await request(app).post("/orders/pending").send({ sku: "SKU-001" });
    expect(res.status).toBe(400);
    expectMatchesSchema(res.body, "Error");
  });

  it("POST /orders/pending returns 409 with an Error body for an orderId that already exists", async () => {
    const res = await request(app).post("/orders/pending").send({
      sku: "SKU-002",
      orderId: "ORD-2201",
      quantity: 1,
      status: "placed",
      placedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(res.status).toBe(409);
    expectMatchesSchema(res.body, "Error");
  });

  it("DELETE /orders/pending/:orderId removes the order", async () => {
    await request(app).post("/orders/pending").send({
      sku: "SKU-001",
      orderId: "ORD-TEST-DELETE",
      quantity: 3,
      status: "placed",
      placedAt: "2026-01-01T00:00:00.000Z",
    });

    const res = await request(app).delete("/orders/pending/ORD-TEST-DELETE");
    expect(res.status).toBe(204);
  });

  it("DELETE /orders/pending/:orderId returns 404 with an Error body for an unknown orderId", async () => {
    const res = await request(app).delete("/orders/pending/ORD-TEST-MISSING");
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });

  it("POST /returns/in-transit creates a return and returns it matching ReturnInTransit", async () => {
    const res = await request(app).post("/returns/in-transit").send({
      sku: "SKU-001",
      returnId: "RET-TEST-CREATE",
      quantity: 2,
      initiatedAt: "2026-01-01T00:00:00.000Z",
      expectedArrivalAt: "2026-01-05T00:00:00.000Z",
    });
    expect(res.status).toBe(201);
    expectMatchesSchema(res.body, "ReturnInTransit");
  });

  it("POST /returns/in-transit returns 400 with an Error body for a malformed request", async () => {
    const res = await request(app).post("/returns/in-transit").send({ sku: "SKU-001" });
    expect(res.status).toBe(400);
    expectMatchesSchema(res.body, "Error");
  });

  it("POST /returns/in-transit returns 409 with an Error body for a returnId that already exists", async () => {
    const res = await request(app).post("/returns/in-transit").send({
      sku: "SKU-003",
      returnId: "RET-3110",
      quantity: 1,
      initiatedAt: "2026-01-01T00:00:00.000Z",
      expectedArrivalAt: "2026-01-05T00:00:00.000Z",
    });
    expect(res.status).toBe(409);
    expectMatchesSchema(res.body, "Error");
  });

  it("DELETE /returns/in-transit/:returnId removes the return", async () => {
    await request(app).post("/returns/in-transit").send({
      sku: "SKU-001",
      returnId: "RET-TEST-DELETE",
      quantity: 2,
      initiatedAt: "2026-01-01T00:00:00.000Z",
      expectedArrivalAt: "2026-01-05T00:00:00.000Z",
    });

    const res = await request(app).delete("/returns/in-transit/RET-TEST-DELETE");
    expect(res.status).toBe(204);
  });

  it("DELETE /returns/in-transit/:returnId returns 404 with an Error body for an unknown returnId", async () => {
    const res = await request(app).delete("/returns/in-transit/RET-TEST-MISSING");
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });
});
