import express from "express";
import { inventoryRouter } from "./routes/inventory.js";
import { movementsRouter } from "./routes/movements.js";

export const app = express();

app.use(express.json());

if (process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on("finish", () => {
            console.log(
                `[global-wms-service] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`,
            );
        });
        next();
    });
}

app.use(inventoryRouter);
app.use(movementsRouter);

// Only start listening when this file is run directly (e.g. `tsx src/server.ts`),
// not when a test file imports `app` to drive it with supertest.
if (process.env.NODE_ENV !== "test") {
    const port = Number(process.env.PORT) || 4001;
    app.listen(port, () => {
        console.log(`global-wms-service listening on http://localhost:${port}`);
    });
}
