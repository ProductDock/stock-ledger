import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
// The SDK's tool-runner helpers are typed against zod's newer "v4" API
// specifically — importing from plain "zod" (the classic v3 API that the
// package still ships alongside it) doesn't type-check against them, even
// though both work fine at runtime.
import { z } from "zod/v4";
import { insertLedgerEntry } from "../ledger/store.js";
import type { LedgerEntry } from "../types.js";

const WMS_URL = process.env.WMS_URL ?? "http://localhost:4001";
const STOREFRONT_URL = process.env.STOREFRONT_URL ?? "http://localhost:4002";

// A small fetch wrapper so every tool surfaces the same real {error} message
// from the mock services on failure, instead of a generic "request failed".
async function fetchJson(url: string, options: { treat404AsNull?: boolean } = {}): Promise<any> {
    let response: Response;
    try {
        response = await fetch(url);
    } catch (cause) {
        const message = `Could not reach ${url}: ${cause instanceof Error ? cause.message : String(cause)}`;
        console.error(`[resolver-agent] ${message}`);
        throw new Error(message);
    }

    if (options.treat404AsNull && response.status === 404) {
        return null;
    }

    const body = await response.json();
    if (!response.ok) {
        const message = typeof body?.error === "string" ? body.error : `Request to ${url} failed (${response.status})`;
        console.warn(`[resolver-agent] ${message}`);
        throw new Error(message);
    }
    return body;
}

// buildTools() is called once per /resolve/:sku request, and takes a
// callback rather than a shared variable — that way two resolutions
// running at the same time never step on each other's result.
export function buildTools(model: string, onRecorded: (entry: LedgerEntry) => void) {
    const getWmsStock = betaZodTool({
        name: "get_wms_stock",
        description:
            "Get the warehouse's current physical inventory record for a SKU: the raw count from the last cycle count, plus when that count happened. This count has NOT been adjusted for anything found in get_wms_movements since then.",
        inputSchema: z.object({
            sku: z.string().describe("The SKU to look up, e.g. SKU-001."),
        }),
        run: async ({ sku }) => JSON.stringify(await fetchJson(`${WMS_URL}/inventory/${sku}`)),
    });

    const getWmsMovements = betaZodTool({
        name: "get_wms_movements",
        description:
            "Get the warehouse's movement history for a SKU (cycle counts, manual adjustments, quarantine events, and quarantine releases), most recent first. Use this to find events that happened after the last cycle count and that would change the real sellable quantity — most importantly quarantine events, which reduce sellable stock immediately even though the on-hand count only catches up at the next cycle count.",
        inputSchema: z.object({
            sku: z.string().describe("The SKU to look up, e.g. SKU-001."),
        }),
        run: async ({ sku }) => JSON.stringify(await fetchJson(`${WMS_URL}/movements/${sku}`)),
    });

    const getStorefrontStock = betaZodTool({
        name: "get_storefront_stock",
        description:
            "Get the webshop's current available-to-sell quantity for a SKU, plus when it last synced from the warehouse feed. This number already has pending-order reservations subtracted and in-transit return credits added — it is not a physical count.",
        inputSchema: z.object({
            sku: z.string().describe("The SKU to look up, e.g. SKU-001."),
        }),
        run: async ({ sku }) => JSON.stringify(await fetchJson(`${STOREFRONT_URL}/stock/${sku}`)),
    });

    const getPendingOrders = betaZodTool({
        name: "get_pending_orders",
        description:
            "Get orders for a SKU that have already reserved stock (subtracted from the webshop's available quantity) but have not shipped yet. Units reserved this way may still be physically present at the warehouse until they ship.",
        inputSchema: z.object({
            sku: z.string().describe("The SKU to look up, e.g. SKU-001."),
        }),
        run: async ({ sku }) => JSON.stringify(await fetchJson(`${STOREFRONT_URL}/orders/pending?sku=${sku}`)),
    });

    const getReturnsInTransit = betaZodTool({
        name: "get_returns_in_transit",
        description:
            "Get returns for a SKU that the webshop has already credited back to its available quantity, but that have not physically arrived at the warehouse yet. Until a return like this lands, expect the warehouse and webshop numbers to disagree by exactly its quantity.",
        inputSchema: z.object({
            sku: z.string().describe("The SKU to look up, e.g. SKU-001."),
        }),
        run: async ({ sku }) => JSON.stringify(await fetchJson(`${STOREFRONT_URL}/returns/in-transit?sku=${sku}`)),
    });

    // The only tool with a side effect. Calling it is both how the agent
    // reports its decision and how that decision gets written to the ledger.
    const recordResolution = betaZodTool({
        name: "record_resolution",
        description:
            "Record how you resolved this SKU. Call this exactly once, after you've investigated, to finish the task. This both reports your decision and writes it to the permanent audit ledger — there is no other way to submit a result.",
        inputSchema: z.object({
            sku: z.string().describe("The SKU you investigated."),
            resolvedQty: z.number().describe("The quantity you believe is actually correct and sellable right now."),
            confidence: z
                .enum(["high", "medium", "low"])
                .describe("How confident you are in resolvedQty, given what you found."),
            recommendedAction: z
                .enum(["trust_wms", "trust_storefront", "needs_human_review"])
                .describe(
                    "trust_wms: the warehouse's number is correct once you account for what you found. trust_storefront: the webshop's number is correct. needs_human_review: nothing you found explains the gap — don't guess, say so.",
                ),
            reasoning: z
                .string()
                .describe(
                    "Plain-language explanation of what you checked and why you reached this conclusion. This is what makes the ledger entry auditable — write it for someone who wasn't watching you investigate.",
                ),
        }),
        run: async (input) => {
            // 404 here means the SKU genuinely doesn't exist in that system (not
            // that the system is down) — recorded as null rather than failing.
            const [warehouse, webshop] = await Promise.all([
                fetchJson(`${WMS_URL}/inventory/${input.sku}`, { treat404AsNull: true }),
                fetchJson(`${STOREFRONT_URL}/stock/${input.sku}`, { treat404AsNull: true }),
            ]);

            const entry: LedgerEntry = {
                sku: input.sku,
                timestamp: new Date().toISOString(),
                model,
                wmsQty: warehouse?.quantityOnHand ?? null,
                storefrontQty: webshop?.quantityAvailable ?? null,
                resolvedQty: input.resolvedQty,
                confidence: input.confidence,
                recommendedAction: input.recommendedAction,
                reasoning: input.reasoning,
            };

            insertLedgerEntry(entry);
            onRecorded(entry);

            return "Resolution recorded.";
        },
    });

    return [
        getWmsStock,
        getWmsMovements,
        getStorefrontStock,
        getPendingOrders,
        getReturnsInTransit,
        recordResolution,
    ];
}
