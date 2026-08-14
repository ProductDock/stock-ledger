import { Router } from "express";
import { pendingOrders } from "../data/seed.js";
import type { OrderStatus, PendingOrder } from "../types.js";

export const ordersRouter = Router();

ordersRouter.get("/orders/pending", (req, res) => {
  const sku = req.query.sku;

  if (typeof sku !== "string") {
    res.status(400).json({ error: "Query parameter 'sku' is required." });
    return;
  }

  const orders = pendingOrders.filter((order) => order.sku === sku);
  res.json(orders);
});

const ORDER_STATUSES: OrderStatus[] = ["placed", "picking", "shipped"];

function isValidOrderBody(body: unknown): body is PendingOrder {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;
  return (
    typeof b.sku === "string" &&
    typeof b.orderId === "string" &&
    typeof b.quantity === "number" &&
    typeof b.status === "string" &&
    ORDER_STATUSES.includes(b.status as OrderStatus) &&
    typeof b.placedAt === "string"
  );
}

ordersRouter.post("/orders/pending", (req, res) => {
  if (!isValidOrderBody(req.body)) {
    res.status(400).json({
      error: "Body must include sku (string), orderId (string), quantity (number), status (one of placed, picking, shipped), and placedAt (string).",
    });
    return;
  }

  if (pendingOrders.some((order) => order.orderId === req.body.orderId)) {
    res.status(409).json({ error: `Order already exists: ${req.body.orderId}` });
    return;
  }

  pendingOrders.push(req.body);
  res.status(201).json(req.body);
});

ordersRouter.delete("/orders/pending/:orderId", (req, res) => {
  const index = pendingOrders.findIndex((order) => order.orderId === req.params.orderId);

  if (index === -1) {
    res.status(404).json({ error: `Unknown order: ${req.params.orderId}` });
    return;
  }

  pendingOrders.splice(index, 1);
  res.status(204).end();
});
