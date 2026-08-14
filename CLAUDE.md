# stock-ledger

Three small services. `global-wms-service` (port 4001) and `retail-storefront-service`
(port 4002) each hold their own, independently-shaped view of stock levels
for the same SKUs — they will legitimately disagree with each other, and
that's by design, not a bug. Both store their data in plain in-memory
arrays (seeded fresh on every restart) and expose `POST`/`PUT`/`DELETE`
endpoints alongside their `GET` ones, so a developer can hand-edit records
to build their own scenarios. `resolver-agent` (port 4003) calls both over
plain HTTP — only their `GET` endpoints, never the write ones — asks Claude
to investigate any disagreement, and writes the outcome to a local SQLite
ledger.

Each service is an npm workspace under `services/*`, plain Express +
TypeScript, run directly with `tsx` (no build step).

## Commands

-   `npm install` — installs all three services at once.
-   `npm run dev:wms` / `npm run dev:storefront` / `npm run dev:agent` — run one service (each needs its own terminal).
-   `npm test` — runs the contract tests for `global-wms-service` and `retail-storefront-service`.
-   `npx tsc --noEmit -p services/<name>/tsconfig.json` — type-check a single service.

`resolver-agent` has no automated tests — its behavior depends on a live
call to Claude, so there's no fixed expected output to assert against.
Verify changes to it by actually running a request against it.

## Security constraints

-   Never read, print, or quote the contents of any `.env` file in this repo. `services/resolver-agent/.env` holds a real Anthropic API key.
-   Never commit a `.env` file, an API key, or `services/resolver-agent/src/ledger/stock-ledger.db`. All three are gitignored — don't work around that.
-   None of the three services have authentication. This is intentional and central to what this project demonstrates — do not add auth, rate limiting, or other access control unless explicitly asked.
-   `resolver-agent` must never gain a tool that calls a mutating (`POST`/`PUT`/`DELETE`) endpoint on `global-wms-service` or `retail-storefront-service` — see `services/resolver-agent/src/agent/tools.ts`. The write endpoints on the other two services exist for developers building test scenarios by hand, not for the agent. This boundary is enforced purely by which tools exist in `tools.ts`, not by any server-side check — don't add one there either; keep the boundary where it already is.

## Conventions

-   Prefer simple, direct code over clever abstractions. This is a small demo project — a bug fix or small feature doesn't need a new abstraction layer.
-   The domain vocabulary is "resolve" / "resolution", not "reconcile" / "reconciliation" — e.g. `POST /resolve/:sku`, the `record_resolution` tool, the `resolvedQty` field. Keep new code consistent with that.
-   `global-wms-service` and `retail-storefront-service` deliberately do not share a types package or a database — they're meant to model two genuinely independent real-world systems. Don't introduce shared state between them.
-   Field and endpoint descriptions (in `openapi.yaml` and tool `description`s) are written to be understood by an LLM caller, not just a human reader — keep that level of detail when adding new fields or tools.
