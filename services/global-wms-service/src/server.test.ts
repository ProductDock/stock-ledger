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

describe("global-wms-service contract", () => {
  it("GET /inventory returns records matching InventoryRecord", async () => {
    const res = await request(app).get("/inventory");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const record of res.body) {
      expectMatchesSchema(record, "InventoryRecord");
    }
  });

  it("GET /inventory/:sku returns a record matching InventoryRecord", async () => {
    const res = await request(app).get("/inventory/SKU-001");
    expect(res.status).toBe(200);
    expectMatchesSchema(res.body, "InventoryRecord");
  });

  it("GET /inventory/:sku returns 404 with an Error body for an unknown SKU", async () => {
    const res = await request(app).get("/inventory/SKU-999");
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });

  it("GET /movements/:sku returns entries matching StockMovement", async () => {
    const res = await request(app).get("/movements/SKU-004");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const movement of res.body) {
      expectMatchesSchema(movement, "StockMovement");
    }
  });

  it("GET /movements/:sku returns 404 with an Error body for an unknown SKU", async () => {
    const res = await request(app).get("/movements/SKU-999");
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });
});

describe("global-wms-service write endpoints", () => {
  it("POST /inventory creates a record and returns it matching InventoryRecord", async () => {
    const res = await request(app).post("/inventory").send({
      sku: "SKU-TEST-CREATE",
      quantityOnHand: 5,
      lastCountedAt: "2026-01-01T00:00:00.000Z",
      location: "Z9",
    });
    expect(res.status).toBe(201);
    expectMatchesSchema(res.body, "InventoryRecord");

    const getRes = await request(app).get("/inventory/SKU-TEST-CREATE");
    expect(getRes.status).toBe(200);
    expect(getRes.body.quantityOnHand).toBe(5);
  });

  it("POST /inventory returns 400 with an Error body for a malformed request", async () => {
    const res = await request(app).post("/inventory").send({ sku: "SKU-TEST-BAD" });
    expect(res.status).toBe(400);
    expectMatchesSchema(res.body, "Error");
  });

  it("POST /inventory returns 409 with an Error body for a SKU that already exists", async () => {
    const res = await request(app).post("/inventory").send({
      sku: "SKU-001",
      quantityOnHand: 1,
      lastCountedAt: "2026-01-01T00:00:00.000Z",
      location: "Z9",
    });
    expect(res.status).toBe(409);
    expectMatchesSchema(res.body, "Error");
  });

  it("PUT /inventory/:sku updates a record and returns it matching InventoryRecord", async () => {
    await request(app).post("/inventory").send({
      sku: "SKU-TEST-UPDATE",
      quantityOnHand: 5,
      lastCountedAt: "2026-01-01T00:00:00.000Z",
      location: "Z9",
    });

    const res = await request(app).put("/inventory/SKU-TEST-UPDATE").send({
      quantityOnHand: 9,
      lastCountedAt: "2026-01-02T00:00:00.000Z",
      location: "Z8",
    });
    expect(res.status).toBe(200);
    expectMatchesSchema(res.body, "InventoryRecord");
    expect(res.body.quantityOnHand).toBe(9);
  });

  it("PUT /inventory/:sku returns 404 with an Error body for an unknown SKU", async () => {
    const res = await request(app).put("/inventory/SKU-TEST-MISSING").send({
      quantityOnHand: 1,
      lastCountedAt: "2026-01-01T00:00:00.000Z",
      location: "Z9",
    });
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });

  it("DELETE /inventory/:sku removes the record", async () => {
    await request(app).post("/inventory").send({
      sku: "SKU-TEST-DELETE",
      quantityOnHand: 5,
      lastCountedAt: "2026-01-01T00:00:00.000Z",
      location: "Z9",
    });

    const res = await request(app).delete("/inventory/SKU-TEST-DELETE");
    expect(res.status).toBe(204);

    const getRes = await request(app).get("/inventory/SKU-TEST-DELETE");
    expect(getRes.status).toBe(404);
  });

  it("DELETE /inventory/:sku returns 404 with an Error body for an unknown SKU", async () => {
    const res = await request(app).delete("/inventory/SKU-TEST-MISSING");
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });

  it("POST /movements records a movement and returns it matching StockMovement", async () => {
    const res = await request(app).post("/movements").send({
      sku: "SKU-001",
      occurredAt: "2026-01-01T00:00:00.000Z",
      type: "adjustment",
      quantityDelta: 2,
      note: "test movement",
    });
    expect(res.status).toBe(201);
    expectMatchesSchema(res.body, "StockMovement");
  });

  it("POST /movements returns 400 with an Error body for a malformed request", async () => {
    const res = await request(app).post("/movements").send({ sku: "SKU-001" });
    expect(res.status).toBe(400);
    expectMatchesSchema(res.body, "Error");
  });

  it("POST /movements returns 404 with an Error body for an unknown SKU", async () => {
    const res = await request(app).post("/movements").send({
      sku: "SKU-TEST-MISSING",
      occurredAt: "2026-01-01T00:00:00.000Z",
      type: "adjustment",
      quantityDelta: 2,
      note: "test movement",
    });
    expect(res.status).toBe(404);
    expectMatchesSchema(res.body, "Error");
  });
});
