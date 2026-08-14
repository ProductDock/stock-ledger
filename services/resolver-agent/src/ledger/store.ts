import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { LedgerEntry } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A plain file on disk — no separate database server to run. It's created
// automatically the first time this service starts. Tests point this at
// ":memory:" (via LEDGER_DB_PATH) so they never touch the real ledger.
const dbPath = process.env.LEDGER_DB_PATH ?? path.join(__dirname, "stock-ledger.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    model TEXT NOT NULL,
    wmsQty INTEGER,
    storefrontQty INTEGER,
    resolvedQty INTEGER NOT NULL,
    confidence TEXT NOT NULL,
    recommendedAction TEXT NOT NULL,
    reasoning TEXT NOT NULL
  )
`);

const insertStatement = db.prepare(`
  INSERT INTO ledger_entries
    (sku, timestamp, model, wmsQty, storefrontQty, resolvedQty, confidence, recommendedAction, reasoning)
  VALUES
    (@sku, @timestamp, @model, @wmsQty, @storefrontQty, @resolvedQty, @confidence, @recommendedAction, @reasoning)
`);

export function insertLedgerEntry(entry: LedgerEntry): void {
  insertStatement.run(entry);
}

export function getLedgerForSku(sku: string): LedgerEntry[] {
  return db
    .prepare(
      `SELECT sku, timestamp, model, wmsQty, storefrontQty, resolvedQty, confidence, recommendedAction, reasoning
       FROM ledger_entries WHERE sku = ? ORDER BY timestamp DESC`,
    )
    .all(sku) as LedgerEntry[];
}

export function getAllLedgerEntries(): LedgerEntry[] {
  return db
    .prepare(
      `SELECT sku, timestamp, model, wmsQty, storefrontQty, resolvedQty, confidence, recommendedAction, reasoning
       FROM ledger_entries ORDER BY timestamp DESC`,
    )
    .all() as LedgerEntry[];
}
