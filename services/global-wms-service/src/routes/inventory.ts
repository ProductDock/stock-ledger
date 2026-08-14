import { Router } from "express";
import { inventory } from "../data/seed.js";
import type { InventoryRecord } from "../types.js";

export const inventoryRouter = Router();

inventoryRouter.get("/inventory", (_req, res) => {
  res.json(inventory);
});

inventoryRouter.get("/inventory/:sku", (req, res) => {
  const record = inventory.find((item) => item.sku === req.params.sku);

  if (!record) {
    res.status(404).json({ error: `Unknown SKU: ${req.params.sku}` });
    return;
  }

  res.json(record);
});

function isValidRecordBody(body: unknown): body is InventoryRecord {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;
  return (
    typeof b.sku === "string" &&
    typeof b.quantityOnHand === "number" &&
    typeof b.lastCountedAt === "string" &&
    typeof b.location === "string"
  );
}

inventoryRouter.post("/inventory", (req, res) => {
  if (!isValidRecordBody(req.body)) {
    res.status(400).json({
      error: "Body must include sku (string), quantityOnHand (number), lastCountedAt (string), and location (string).",
    });
    return;
  }

  if (inventory.some((item) => item.sku === req.body.sku)) {
    res.status(409).json({ error: `SKU already exists: ${req.body.sku}` });
    return;
  }

  inventory.push(req.body);
  res.status(201).json(req.body);
});

inventoryRouter.put("/inventory/:sku", (req, res) => {
  const record = inventory.find((item) => item.sku === req.params.sku);

  if (!record) {
    res.status(404).json({ error: `Unknown SKU: ${req.params.sku}` });
    return;
  }

  const body = req.body as Record<string, unknown>;
  if (
    typeof body?.quantityOnHand !== "number" ||
    typeof body?.lastCountedAt !== "string" ||
    typeof body?.location !== "string"
  ) {
    res.status(400).json({
      error: "Body must include quantityOnHand (number), lastCountedAt (string), and location (string).",
    });
    return;
  }

  record.quantityOnHand = body.quantityOnHand;
  record.lastCountedAt = body.lastCountedAt;
  record.location = body.location;
  res.json(record);
});

inventoryRouter.delete("/inventory/:sku", (req, res) => {
  const index = inventory.findIndex((item) => item.sku === req.params.sku);

  if (index === -1) {
    res.status(404).json({ error: `Unknown SKU: ${req.params.sku}` });
    return;
  }

  inventory.splice(index, 1);
  res.status(204).end();
});
