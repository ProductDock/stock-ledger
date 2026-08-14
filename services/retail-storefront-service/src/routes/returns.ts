import { Router } from "express";
import { returnsInTransit } from "../data/seed.js";
import type { ReturnInTransit } from "../types.js";

export const returnsRouter = Router();

returnsRouter.get("/returns/in-transit", (req, res) => {
  const sku = req.query.sku;

  if (typeof sku !== "string") {
    res.status(400).json({ error: "Query parameter 'sku' is required." });
    return;
  }

  const returns = returnsInTransit.filter((entry) => entry.sku === sku);
  res.json(returns);
});

function isValidReturnBody(body: unknown): body is ReturnInTransit {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;
  return (
    typeof b.sku === "string" &&
    typeof b.returnId === "string" &&
    typeof b.quantity === "number" &&
    typeof b.initiatedAt === "string" &&
    typeof b.expectedArrivalAt === "string"
  );
}

returnsRouter.post("/returns/in-transit", (req, res) => {
  if (!isValidReturnBody(req.body)) {
    res.status(400).json({
      error: "Body must include sku (string), returnId (string), quantity (number), initiatedAt (string), and expectedArrivalAt (string).",
    });
    return;
  }

  if (returnsInTransit.some((entry) => entry.returnId === req.body.returnId)) {
    res.status(409).json({ error: `Return already exists: ${req.body.returnId}` });
    return;
  }

  returnsInTransit.push(req.body);
  res.status(201).json(req.body);
});

returnsRouter.delete("/returns/in-transit/:returnId", (req, res) => {
  const index = returnsInTransit.findIndex((entry) => entry.returnId === req.params.returnId);

  if (index === -1) {
    res.status(404).json({ error: `Unknown return: ${req.params.returnId}` });
    return;
  }

  returnsInTransit.splice(index, 1);
  res.status(204).end();
});
