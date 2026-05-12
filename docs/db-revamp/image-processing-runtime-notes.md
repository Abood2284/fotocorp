# Image Processing Runtime Notes

Context for **Sharp** and other image libraries relative to **Cloudflare Workers** and local/Node tooling.

## Current finding

**Native Sharp failed inside the Cloudflare Worker runtime.**

Summary: Workers do not support **dynamic `require()` of native Node addons** the way a full Node process does. Sharp relies on native binaries; loading them inside the Worker bundle/runtime fails (native module / `require` path not supported).

Derivative generation for production-like processing today runs in **Node-capable** contexts (for example `tsx` scripts under `apps/api/scripts/media/`), not inside the Worker fetch handler.

## `apps/jobs` (Node CLI, not a Worker)

- **`apps/jobs` is a Node-oriented jobs package**, invoked with `tsx` (see `pnpm --dir apps/jobs publish:dry-run` and `smoke:sharp`). It is **not** a Cloudflare Worker service and does not export a `fetch()` handler.
- **Native Sharp must run in a real Node runtime.** The Sharp smoke script `apps/jobs/scripts/smoke/check-sharp-node.ts` proves Sharp loads in this package.
- **Cloudflare Worker runtime packages (`apps/api` Worker entry, etc.) must not import native Sharp** for request-path code. Keep Sharp in Node CLIs / off-Worker workers only.
- **Admin approval must not directly make assets public.** Required publish work includes Fotokey assignment, canonical original copy, and preview/derivative generation; assets become public only after that work succeeds (see [fotokey-publish-pipeline.md](./fotokey-publish-pipeline.md)).

## Candidate options

| Option | Worker compatible? | Metadata support | Watermark support | Cost | Notes |
| --- | --- | --- | --- | --- | --- |
| Sharp native inside Worker | No | Strong | Strong | Low at edge | Blocked by native module constraints. |
| Sharp WASM | Partial / experimental | Varies | Varies | CPU-bound on edge | Bundle size and latency tradeoffs; verify feature parity. |
| Jimp | Yes (pure JS) | Moderate | Possible | CPU | Slower; quality/perf vs Sharp. |
| Photon (WASM) | Yes | Moderate | Possible | CPU | Rust/WASM ecosystem; evaluate ops fit. |
| Cloudflare Images / Transformations | Yes (platform) | Varies | Varies | Per usage | Vendor feature matrix vs watermark + exact control. |
| Node jobs + Sharp | Yes (off Worker) | Strong | Strong | Infra for workers/queues | Common pattern: queue from Worker, process in Node. |
| ASPJPEG (Windows/IIS) | N/A (non-CF) | Legacy | Legacy | Legacy host | Not applicable to Workers; listed for legacy-system comparison only. |

## Current recommendation status

**Investigation pending.** No final platform decision is documented here until an option is implemented end-to-end for the Worker + storage pipeline.
