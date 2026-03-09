# Agent Treasury Guard

[English](./README.md) | [简体中文](./README.zh-CN.md)

Built on OKX Skills, sold as AI decision workflows.

Quick links:

- [Chinese README](./README.zh-CN.md)
- [Skill Layer](./SKILL.md)
- [Integration Contract](./openapi.yaml)
- [Architecture](./docs/architecture.md)
- [Narrative Visuals (ZH)](./docs/article-visuals-zh.md)
- [Value Narrative (ZH)](./docs/longform-intro-zh.md)
- [Live Proof](./docs/live-proof.md)
- [Evidence Ledger](./docs/workflow-evidence.md)
- [Submission Checklist (ZH)](./docs/final-submission-checklist-zh.md)

Agent Treasury Guard is a local-first OKX OnchainOS skill package built on top of OKX Skills.
OKX provides the base onchain skills, and Treasury Guard packages them into paid AI decision workflows that other AIs can call directly.

The product structure is explicit:

- free layer: discover candidates through a lightweight opportunity scan
- paid layer: turn a token or a caller-supplied thesis into a policy-gated entry, exit, and watch workflow
- marketplace layer: Treasury Guard ships with house research, accepts caller BYO-thesis requests directly, and keeps a 20% platform take rate only on approved provider workflows

Treasury Guard is not trying to replace stronger reasoning models. It is the execution and control layer they can call when they want an idea translated into a safe, standard, monetizable onchain workflow.

The package ships with two adapters:

- `mock`: default, deterministic demo mode with fixture data for hackathon videos and tests.
- `onchainos-cli`: live mode that shells out to the official `onchainos` CLI and reuses the OKX skills stack.
- `okx-http`: live mode that calls the official OKX Market + Trade HTTP APIs directly with your OKX credentials.

For payments, the package also ships with two x402 adapters:

- `mock-x402`: deterministic invoice, verify, and settle flow for demos.
- `okx-x402-api`: live adapter for OKX x402 `supported`, `verify`, and `settle` endpoints.

## What It Does

- `find-opportunities`: scan OKX market signals, enrich them with token analytics and holder concentration, then rank the best guarded entries.
- `prepare-trade`: resolve a token, run treasury policy checks, pull an OKX quote, and return a machine-readable guarded entry plan.
- `prepare-exit-plan`: turn a sell/derisk request into a staged exit plan with treasury policy checks and clear next actions.
- `prepare-thesis-plan`: let another AI bring its own thesis, then validate it against live OKX data and convert it into a guarded plan.
- `watch plan`: every entry or exit plan now includes checkpoints and triggers so another AI can monitor the position after the first action.
- `track-execution`: follow an OKX gateway order and normalize it into a simple status object.
- `premium paywall`: protect the high-value outputs behind x402 so another AI pays per request.

## Quick Start

```bash
cd agent-treasury-guard
npm test
node src/cli.js find-opportunities --chain base --format markdown
node src/cli.js prepare-trade --side buy --symbol BRETT --chain base --budget-usd 1000 --format markdown
node src/cli.js prepare-exit-plan --symbol PEPE --chain ethereum --budget-usd 1000 --format markdown
node src/cli.js prepare-thesis-plan --side buy --symbol BRETT --chain base --budget-usd 1000 --thesis "Why another AI likes this setup" --format markdown
node src/cli.js track-execution --chain base --order-id demo-order-1 --format markdown
npm run premium:demo
npm run premium:demo-trade
npm run premium:demo-exit
npm run preflight
```

`premium:demo` does not open a socket. It simulates the full x402 flow in-process:

1. Request premium research
2. Receive `402 Payment Required`
3. Create a mock x402 payment payload
4. Resend with `X-PAYMENT`
5. Receive the unlocked expert result

Before recording or submitting, run:

```bash
npm run preflight
```

This checks the local live setup, thesis mode, settlement assets, and attempts a read-only `/supported` probe when live OKX payment credentials are present.

## Live Mode With Official OKX CLI

1. Install the official `onchainos` CLI and set OKX credentials as described in the OKX skills docs.
2. Export:

```bash
export TREASURY_GUARD_ADAPTER=onchainos-cli
export ONCHAINOS_BIN=onchainos
```

3. Run the same commands. The planner will call:

- `onchainos token search`
- `onchainos token price-info`
- `onchainos token holders`
- `onchainos market signal-list`
- `onchainos swap quote`
- `onchainos gateway orders`

If you do not have the official CLI installed locally, switch to the direct HTTP live adapter:

```bash
export TREASURY_GUARD_ADAPTER=okx-http
export OKX_API_KEY=...
export OKX_SECRET_KEY=...
export OKX_API_PASSPHRASE=...
```

This adapter uses the current OKX HTTP endpoints:

- `GET /api/v6/dex/market/token/search`
- `POST /api/v6/dex/market/price-info`
- `GET /api/v6/dex/market/token/holder`
- `GET /api/v6/dex/market/token/toplist`
- `GET /api/v6/dex/aggregator/quote`

For live x402, set:

```bash
export TREASURY_GUARD_PAYMENT_ADAPTER=okx-api
export TREASURY_GUARD_MERCHANT_ADDRESS=0x...
export OKX_API_KEY=...
export OKX_SECRET_KEY=...
export OKX_API_PASSPHRASE=...
```

For a real wallet-backed buyer, the repository now ships with a built-in payer:

```bash
export TREASURY_GUARD_PAYER=real-wallet
export X402_TEST_PRIVATE_KEY=0x...
```

If you prefer to delegate signing to an external wallet service or agent runtime, switch back to `command` mode:

```bash
export TREASURY_GUARD_PAYER=command
export TREASURY_GUARD_PAYER_COMMAND="node ./examples/mock-command-payer.js"
```

The payment adapter will use the current OKX x402 endpoints:

- `GET /supported`
- `POST /verify`
- `POST /settle`

If you do not set `OKX_PAYMENT_BASE_PATH`, the live adapter will try the known OKX x402 base paths in order:

- `/api/v6/x402`
- `/api/v6/wallet/payments`
- `/api/v6/payments`

`OKX_PROJECT_ID` is optional. The current live x402 endpoints can be called without it.
`/supported` responses are cached in-memory for `TREASURY_GUARD_PAYMENT_SUPPORTED_TTL_MS` (default `300000ms`). Call `/supported?refresh=1` to force refresh.

Current OKX documentation states that x402 support is on `X Layer (196)` with `USDG`, `USDT`, and `USDC`. Treasury Guard now advertises all three in the same invoice by default.

## Premium A2A Flow

The service now exposes two layers:

- free discovery:
  - `GET /opportunities`
- premium guarded workflows:
  - `GET /premium/opportunities`
  - `POST /premium/trade-plan`
  - `POST /premium/thesis-plan`
  - `GET /supported`
  - `GET /manifest`

The intended product motion is:

1. use `/opportunities` to shortlist candidates
2. use `/premium/trade-plan` when Treasury Guard owns the research and routing
3. use `/premium/thesis-plan` when another AI already has the thesis and needs validation, policy checks, execution, exit, and watch rules
4. attach `providerId + providerName + providerPayoutAddress` only when the thesis is coming from an approved provider that should participate in revenue share

The monetization model is hybrid:

- house workflows: Treasury Guard monetizes its own research directly
- caller BYO-thesis workflows: another AI can bring its own thesis and buy Treasury Guard validation directly with no provider split
- provider workflows: approved providers bring their thesis plus payout metadata, Treasury Guard validates and operationalizes it, and the platform keeps a 20% take rate while routing 80% to the provider ledger

If the request has no `X-PAYMENT` header, the server returns `402` with `paymentRequirements`.
The `402` response also includes a protocol descriptor so another AI can follow the flow deterministically:

1. Request protected resource
2. Receive invoice
3. Sign payment payload
4. Retry with `X-PAYMENT`
5. Provider verifies
6. Provider settles
7. Premium result unlocks

If the caller attaches a valid x402 payment, the server:

1. Verifies the payment
2. Settles it
3. Unlocks the Treasury Guard result

This is the A2A product story: another AI does not need to rebuild token search, market analytics, quote routing, treasury policy logic, watch triggers, or payment settlement. It just buys the higher-level workflow.

## Premium Commands

Run the paywall server locally:

```bash
npm run premium:server
```

Run a free opportunity scan:

```bash
npm run premium:free-scan
```

Buy an optional premium opportunity deep scan:

```bash
npm run premium:scan
```

Buy a premium trade plan:

```bash
npm run premium:trade
```

Buy a premium exit plan:

```bash
npm run premium:exit
```

Buy a premium BYO thesis plan:

```bash
npm run premium:thesis
```

Run the in-process paid trade-plan demo:

```bash
npm run premium:demo-trade
```

Run the in-process paid exit-plan demo:

```bash
npm run premium:demo-exit
```

Run a read-only live x402 smoke test with an intentionally invalid dummy signature:

```bash
npm run premium:live-smoke
```

Run a real wallet-backed live payment smoke for the optional premium opportunity deep scan:

```bash
npm run premium:real-payment-smoke
```

Run a real wallet-backed live payment smoke for the premium trade plan:

```bash
npm run premium:real-payment-trade-smoke
```

Run a real wallet-backed live payment smoke for the premium exit plan:

```bash
npm run premium:real-payment-exit-smoke
```

Run a real wallet-backed live payment smoke for the premium thesis plan:

```bash
npm run premium:real-payment-thesis-smoke
```

By default, the thesis smoke validates a direct BYO-thesis purchase with no provider split.
To simulate an approved provider workflow with `20/80` revenue share, also set:

```bash
export TREASURY_GUARD_REAL_SMOKE_PROVIDER_ID=provider-brett
export TREASURY_GUARD_REAL_SMOKE_PROVIDER_NAME="Brett Signal AI"
export TREASURY_GUARD_REAL_SMOKE_PROVIDER_KIND=external
export TREASURY_GUARD_REAL_SMOKE_PROVIDER_PAYOUT_ADDRESS=0x...
```

Run the same live payment smokes with live OKX market/trade analysis instead of mock analysis:

```bash
export TREASURY_GUARD_REAL_SMOKE_ANALYSIS_ADAPTER=okx-http
npm run premium:real-payment-trade-smoke
npm run premium:real-payment-exit-smoke
```

For a concise, recording-friendly all-live summary, use:

```bash
npm run premium:live-demo-trade
npm run premium:live-demo-exit
npm run premium:live-demo-thesis
```

For a compact proof ledger of the verified live runs, see:

- [live-proof.md](./docs/live-proof.md)
- [workflow-evidence.md](./docs/workflow-evidence.md)

## Real Payer Integration

The current repository now separates:

- `payment adapter`: provider-side `supported / verify / settle`
- `payer`: buyer-side signer that creates the x402 `paymentPayload`

The default buyer is `mock`. For live signing, you can use the built-in `real-wallet` payer:

```bash
export TREASURY_GUARD_PAYER=real-wallet
export X402_TEST_PRIVATE_KEY=0x...
```

Or switch to `command` and delegate signing to any local wallet service, agent runtime, or external script:

```bash
export TREASURY_GUARD_PAYER=command
export TREASURY_GUARD_PAYER_COMMAND="node ./examples/mock-command-payer.js"
```

The command receives JSON on `stdin`:

```json
{
  "paymentRequirements": { "...": "invoice" },
  "payer": "0x...",
  "invoice": { "...": "402 response payload" }
}
```

It must print a JSON `paymentPayload` to `stdout`.

The built-in `real-wallet` payer expects token EIP-712 domain metadata in `paymentRequirements.extra.name/version`. Treasury Guard now includes verified X Layer signing profiles for `USDG`, `USDT`, and `USDC`. `USDG` does not expose a readable `version()` onchain, so the repository uses the live-verified profile `Global Dollar / 1`.

To use an external signer instead, replace the example payer with a real signer that:

1. Reads the OKX invoice from `paymentRequirements`
2. Builds the x402 authorization for the exact protected request
3. Signs it with the payer wallet
4. Returns the signed `paymentPayload`
5. Lets Treasury Guard retry the request with `X-PAYMENT`

The repository now includes both a read-only live smoke (`premium:live-smoke`) and real end-to-end payment smokes (`premium:real-payment-smoke`, `premium:real-payment-trade-smoke`, `premium:real-payment-exit-smoke`).

## Integration Assets

- OpenAPI contract: [openapi.yaml](./openapi.yaml)
- Service architecture: [architecture.md](./docs/architecture.md)
- Hackathon talking points and demo outline: [hackathon-kit.md](./docs/hackathon-kit.md)
- Chinese project summary: [project-summary-zh.md](./docs/project-summary-zh.md)
- Chinese demo script: [demo-script-zh.md](./docs/demo-script-zh.md)
- Chinese X post draft: [x-post-zh.md](./docs/x-post-zh.md)
- Chinese form answers: [form-answers-zh.md](./docs/form-answers-zh.md)
- Chinese prompt sheet: [prompts-zh.md](./docs/prompts-zh.md)
- Provider prompt: [provider-system.md](./prompts/provider-system.md)
- Buyer prompt: [buyer-system.md](./prompts/buyer-system.md)

## Example Commands

```bash
node src/cli.js find-opportunities \
  --chain solana \
  --budget-usd 1000 \
  --risk-profile balanced \
  --format markdown
```

```bash
node src/cli.js prepare-exit-plan \
  --symbol PEPE \
  --chain ethereum \
  --budget-usd 1000 \
  --risk-profile balanced \
  --format json
```

## Output Contract

Every command returns either Markdown or JSON. Trade, thesis, and exit plans now include:

- `policy`: mandate checks, pass/review/block status, and failing reasons
- `watch`: next review time, checkpoints, and machine-readable triggers
- `machineView`: structured next calls so another AI can execute or monitor without re-deriving the workflow

That is the core product value: the caller does not need to stitch together token search, analytics, treasury policy logic, swap quoting, monitoring rules, or order tracking.

The premium server extends that idea into monetization: another AI pays once and receives the full workflow result instead of composing the OKX primitives and payment rails itself.

That is the commercial argument:

- OKX gives free primitives
- Treasury Guard sells policy, execution structure, exit logic, and watch rules
- stronger AIs can keep their own reasoning layer and still rely on Treasury Guard as the control plane
- approved external providers can monetize through the same control plane with an explicit 20% platform take rate
