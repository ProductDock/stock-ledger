import { Router } from "express";
import { stock } from "../data/seed.js";
import type { StockRecord } from "../types.js";

export const stockRouter = Router();

stockRouter.get("/stock", (_req, res) => {
  res.json(stock);
});

stockRouter.get("/stock/:sku", (req, res) => {
  const record = stock.find((item) => item.sku === req.params.sku);

  if (!record) {
    res.status(404).json({ error: `Unknown SKU: ${req.params.sku}` });
    return;
  }

  res.json(record);
});

function isValidRecordBody(body: unknown): body is StockRecord {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;
  return typeof b.sku === "string" && typeof b.quantityAvailable === "number" && typeof b.lastSyncedAt === "string";
}

stockRouter.post("/stock", (req, res) => {
  if (!isValidRecordBody(req.body)) {
    res.status(400).json({
      error: "Body must include sku (string), quantityAvailable (number), and lastSyncedAt (string).",
    });
    return;
  }

  if (stock.some((item) => item.sku === req.body.sku)) {
    res.status(409).json({ error: `SKU already exists: ${req.body.sku}` });
    return;
  }

  stock.push(req.body);
  res.status(201).json(req.body);
});

stockRouter.put("/stock/:sku", (req, res) => {
  const record = stock.find((item) => item.sku === req.params.sku);

  if (!record) {
    res.status(404).json({ error: `Unknown SKU: ${req.params.sku}` });
    return;
  }

  const body = req.body as Record<string, unknown>;
  if (typeof body?.quantityAvailable !== "number" || typeof body?.lastSyncedAt !== "string") {
    res.status(400).json({
      error: "Body must include quantityAvailable (number) and lastSyncedAt (string).",
    });
    return;
  }

  record.quantityAvailable = body.quantityAvailable;
  record.lastSyncedAt = body.lastSyncedAt;
  res.json(record);
});

stockRouter.delete("/stock/:sku", (req, res) => {
  const index = stock.findIndex((item) => item.sku === req.params.sku);

  if (index === -1) {
    res.status(404).json({ error: `Unknown SKU: ${req.params.sku}` });
    return;
  }

  stock.splice(index, 1);
  res.status(204).end();
});
