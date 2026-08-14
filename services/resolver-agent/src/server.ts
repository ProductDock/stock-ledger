import "dotenv/config";
import express from "express";
import { resolveSku } from "./agent/runner.js";
import { getAllLedgerEntries, getLedgerForSku } from "./ledger/store.js";

export const app = express();
app.use(express.json());

// Skipped during tests to keep `npm test` output focused on test results.
if (process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on("finish", () => {
            console.log(
                `[resolver-agent] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`,
            );
        });
        next();
    });
}

app.post("/resolve/:sku", async (req, res) => {
    try {
        const entry = await resolveSku(req.params.sku);
        res.json(entry);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Resolution failed.";
        console.error(`[resolver-agent] failed to resolve ${req.params.sku}: ${message}`);
        res.status(500).json({ error: message });
    }
});

app.get("/ledger/:sku", (req, res) => {
    const history = getLedgerForSku(req.params.sku);
    res.json({ latest: history[0] ?? null, history });
});

app.get("/ledger", (_req, res) => {
    res.json(getAllLedgerEntries());
});

// Only start listening when this file is run directly (e.g. `tsx src/server.ts`),
// not when a test file imports `app` to drive it with supertest.
if (process.env.NODE_ENV !== "test") {
    const port = Number(process.env.PORT) || 4003;
    app.listen(port, () => {
        console.log(`resolver-agent listening on http://localhost:${port}`);
    });
}
