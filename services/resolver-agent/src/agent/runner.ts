import Anthropic from "@anthropic-ai/sdk";
import type { LedgerEntry } from "../types.js";
import { buildTools } from "./tools.js";

// Picks up ANTHROPIC_API_KEY from the environment automatically.
const client = new Anthropic();

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a stock discrepancy resolver. You'll be given a SKU where the warehouse's physical count and the webshop's available count disagree.

Investigate using your tools before concluding anything — check for sync lag (compare timestamps), pending orders, returns in transit, and quarantine events. If you find a cause that fully explains the gap, recommend trusting whichever number is already correct once you account for it.

If nothing you find explains the gap, don't guess — set recommendedAction to needs_human_review and say plainly what you checked and why nothing explained it.

If a lookup tool tells you a SKU is entirely unknown in one system (a 404 / "Unknown SKU" error) while it exists in the other, that's not a disagreement to explain away — it means one system of record has no data for this product at all. Treat that as needs_human_review with low confidence: say which system is missing the SKU, and don't invent a physical count that was never actually observed.

Always finish by calling record_resolution exactly once.`;

export async function resolveSku(sku: string): Promise<LedgerEntry> {
    console.log(`[resolver-agent] investigating ${sku}`);

    let recorded: LedgerEntry | undefined;

    const tools = buildTools(MODEL, (entry) => {
        recorded = entry;
    });

    const runner = client.beta.messages.toolRunner({
        model: MODEL,
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        // Two cache breakpoints. This one covers the tool definitions and the
        // system prompt — ~2.2k tokens that are identical on every request — so
        // it's reused across resolutions, not just within one. It has to sit on
        // the system block rather than at the end: the SKU is in the user
        // message, so a breakpoint after that would be a different prefix for
        // every SKU and would never be reused.
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools,
        // And this one moves with the conversation, so each turn of the tool
        // loop reads back the previous turns instead of paying for them again.
        cache_control: { type: "ephemeral" },
        max_iterations: 10,
        messages: [
            {
                role: "user",
                content: `Investigate SKU ${sku}. The warehouse and webshop systems disagree about how much stock is actually available. Find out why and resolve it.`,
            },
        ],
    });

    // Iterating the runner rather than just awaiting it gives us per-turn usage.
    // A non-zero cacheRead is the only way to confirm caching is actually
    // happening — anything that changes the prefix silently drops it to zero
    // rather than raising an error.
    let cacheRead = 0;
    let cacheWritten = 0;
    for await (const message of runner) {
        cacheWritten += message.usage.cache_creation_input_tokens ?? 0;
        cacheRead += message.usage.cache_read_input_tokens ?? 0;
    }

    if (!recorded) {
        throw new Error(`Agent finished investigating ${sku} without recording a resolution.`);
    }

    console.log(
        `[resolver-agent] ${sku} -> ${recorded.recommendedAction} (confidence: ${recorded.confidence}) ` +
            `[cache: ${cacheRead} read, ${cacheWritten} written]`,
    );

    return recorded;
}
