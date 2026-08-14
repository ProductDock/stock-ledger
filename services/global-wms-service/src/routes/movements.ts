import { Router } from "express";
import { inventory, movements } from "../data/seed.js";
import type { MovementType, StockMovement } from "../types.js";

export const movementsRouter = Router();

movementsRouter.get("/movements/:sku", (req, res) => {
  const isKnownSku = inventory.some((item) => item.sku === req.params.sku);

  if (!isKnownSku) {
    res.status(404).json({ error: `Unknown SKU: ${req.params.sku}` });
    return;
  }

  const skuMovements = movements
    .filter((movement) => movement.sku === req.params.sku)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  res.json(skuMovements);
});

const MOVEMENT_TYPES: MovementType[] = ["cycle_count", "adjustment", "quarantine", "release"];

function isValidMovementBody(body: unknown): body is StockMovement {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;
  return (
    typeof b.sku === "string" &&
    typeof b.occurredAt === "string" &&
    typeof b.type === "string" &&
    MOVEMENT_TYPES.includes(b.type as MovementType) &&
    typeof b.quantityDelta === "number" &&
    typeof b.note === "string"
  );
}

movementsRouter.post("/movements", (req, res) => {
  if (!isValidMovementBody(req.body)) {
    res.status(400).json({
      error:
        "Body must include sku (string), occurredAt (string), type (one of cycle_count, adjustment, quarantine, release), quantityDelta (number), and note (string).",
    });
    return;
  }

  const isKnownSku = inventory.some((item) => item.sku === req.body.sku);
  if (!isKnownSku) {
    res.status(404).json({ error: `Unknown SKU: ${req.body.sku}` });
    return;
  }

  movements.push(req.body);
  res.status(201).json(req.body);
});
