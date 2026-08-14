import express from "express";
import { ordersRouter } from "./routes/orders.js";
import { returnsRouter } from "./routes/returns.js";
import { stockRouter } from "./routes/stock.js";

export const app = express();

app.use(express.json());

if (process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on("finish", () => {
            console.log(
                `[retail-storefront-service] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`,
            );
        });
        next();
    });
}

app.use(stockRouter);
app.use(ordersRouter);
app.use(returnsRouter);

// Only start listening when this file is run directly (e.g. `tsx src/server.ts`),
// not when a test file imports `app` to drive it with supertest.
if (process.env.NODE_ENV !== "test") {
    const port = Number(process.env.PORT) || 4002;
    app.listen(port, () => {
        console.log(`retail-storefront-service listening on http://localhost:${port}`);
    });
}
