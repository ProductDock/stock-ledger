export type Confidence = "high" | "medium" | "low";

export type RecommendedAction = "trust_wms" | "trust_storefront" | "needs_human_review";

export interface LedgerEntry {
    sku: string;
    timestamp: string;
    model: string;
    wmsQty: number | null;
    storefrontQty: number | null;
    resolvedQty: number;
    confidence: Confidence;
    recommendedAction: RecommendedAction;
    reasoning: string;
}
